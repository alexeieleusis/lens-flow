#!/usr/bin/env python3
"""
update-vibe-types-commit.py — advances the pinned vibe-types commit in
src/utils/knowledge-url.ts to the tip of vibe-types' main branch.

Diffs the catalog/ and usecases/ knowledge docs between the old and new
commit, matches changed docs to the rules in src/rules/ that cite them via
knowledgeUrl(...), and runs an AI harness (opencode or claude) against each
matched rule with a prompt containing the diff and full file contents so it
can update — or delete — the rule to match the new guidance. The harness has
no access to the vibe-types repo itself, so all relevant content is inlined
in the prompt.

Usage:
  ./scripts/update-vibe-types-commit.py [--dry-run] [--yes]
      [--tool {opencode,claude}] [--limit N] [--rules NAME[,NAME...]]
      [--vibe-types-repo PATH]

Example:
  ./scripts/update-vibe-types-commit.py --dry-run
  ./scripts/update-vibe-types-commit.py --limit 3 --yes
"""

import argparse
import re
import subprocess
import sys
from functools import lru_cache
from pathlib import Path
from typing import NamedTuple

# ── Config ────────────────────────────────────────────────────────────────────

TARGET_REPO = Path(__file__).resolve().parent.parent
KNOWLEDGE_URL_FILE = TARGET_REPO / "src" / "utils" / "knowledge-url.ts"
RULES_DIR = TARGET_REPO / "src" / "rules"
TESTS_DIR = TARGET_REPO / "tests" / "rules"
PROMPTS_DIR = TARGET_REPO / "scripts" / "prompts"
DEFAULT_VIBE_TYPES_REPO = Path.home() / "development" / "vibe-types"
TYPESCRIPT_SEGMENT = "plugin/skills/typescript"
TRACKED_SUBDIRS = ("catalog", "usecases")

COMMIT_RE = re.compile(r'const COMMIT = "([0-9a-f]{40})"')
KNOWLEDGE_URL_CALL_RE = re.compile(r'knowledgeUrl\(\s*"([^"]+)"')

STATUS_LABELS = {"A": "added", "M": "modified", "D": "deleted"}


class Change(NamedTuple):
    status: str
    old_path: str
    new_path: str

# ── Git helpers ───────────────────────────────────────────────────────────────

def git(*args: str, cwd: Path, capture: bool = True, check: bool = True) -> str | None:
    result = subprocess.run(["git", "-C", str(cwd), *args], capture_output=capture, text=True)
    if result.returncode != 0:
        if check:
            raise RuntimeError(f"git {' '.join(args)} (in {cwd}) failed:\n{result.stderr}")
        return None
    return result.stdout if capture else None


@lru_cache(maxsize=None)
def show_file(vibe_repo: Path, commit: str, path: str) -> str | None:
    return git("show", f"{commit}:{path}", cwd=vibe_repo, check=False)


def resolve_main_commit(vibe_repo: Path) -> str:
    git("fetch", "origin", "main", "--quiet", cwd=vibe_repo, capture=False)
    return git("rev-parse", "origin/main", cwd=vibe_repo).strip()


def diff_knowledge_files(vibe_repo: Path, old_commit: str, new_commit: str) -> list[Change]:
    dirs = [f"{TYPESCRIPT_SEGMENT}/{d}" for d in TRACKED_SUBDIRS]
    output = git("diff", "--name-status", "-M", old_commit, new_commit, "--", *dirs, cwd=vibe_repo)
    changes = []
    for line in output.splitlines():
        if not line.strip():
            continue
        parts = line.split("\t")
        status = parts[0]
        if status.startswith("R"):
            changes.append(Change(status="renamed", old_path=parts[1], new_path=parts[2]))
        else:
            changes.append(Change(
                status=STATUS_LABELS.get(status[0], status),
                old_path=parts[1],
                new_path=parts[1],
            ))
    return changes


@lru_cache(maxsize=None)
def file_diff(vibe_repo: Path, old_commit: str, new_commit: str, old_path: str, new_path: str) -> str:
    return git("diff", old_commit, new_commit, "--", old_path, new_path, cwd=vibe_repo)

# ── Pinned-commit file ────────────────────────────────────────────────────────

def read_pinned_commit() -> str:
    text = KNOWLEDGE_URL_FILE.read_text(encoding="utf-8")
    m = COMMIT_RE.search(text)
    if not m:
        sys.exit(f"error: could not find COMMIT constant in {KNOWLEDGE_URL_FILE}")
    return m.group(1)


def write_pinned_commit(new_commit: str) -> None:
    text = KNOWLEDGE_URL_FILE.read_text(encoding="utf-8")
    updated = COMMIT_RE.sub(f'const COMMIT = "{new_commit}"', text, count=1)
    KNOWLEDGE_URL_FILE.write_text(updated, encoding="utf-8")


def bump_pinned_commit(new_commit: str) -> None:
    write_pinned_commit(new_commit)
    print(f"Bumped pinned commit to {new_commit} in {KNOWLEDGE_URL_FILE.relative_to(TARGET_REPO)}.")

# ── Rule index ────────────────────────────────────────────────────────────────

def knowledge_key(path: str) -> str:
    """Strip the plugin/skills/typescript/ prefix to match knowledgeUrl() path args."""
    prefix = TYPESCRIPT_SEGMENT + "/"
    return path[len(prefix):] if path.startswith(prefix) else path


def build_rule_index() -> dict[str, list[Path]]:
    """Map a knowledgeUrl() path argument to the rule file(s) that cite it."""
    mapping: dict[str, list[Path]] = {}
    for rule_file in sorted(RULES_DIR.glob("*.ts")):
        m = KNOWLEDGE_URL_CALL_RE.search(rule_file.read_text(encoding="utf-8"))
        if m:
            mapping.setdefault(m.group(1), []).append(rule_file)
    return mapping


def match_rules(changes: list[Change], rule_index: dict[str, list[Path]]) -> list[tuple[Path, Change]]:
    matched = []
    for change in changes:
        # old_path == new_path except for renames, so this set is just one key in that case.
        keys = {knowledge_key(change.old_path), knowledge_key(change.new_path)}
        for key in keys:
            for rule_file in rule_index.get(key, []):
                matched.append((rule_file, change))
    return matched

# ── Prompt building ───────────────────────────────────────────────────────────

def build_prompt(rule_file: Path, change: Change, vibe_repo: Path, old_commit: str, new_commit: str) -> str:
    rule_name = rule_file.stem
    rule_relpath = rule_file.relative_to(TARGET_REPO).as_posix()
    test_file = TESTS_DIR / f"{rule_name}.test.ts"
    test_relpath = test_file.relative_to(TARGET_REPO).as_posix()
    has_test = test_file.exists()

    status = change.status
    old_path, new_path = change.old_path, change.new_path
    knowledge_path = old_path if status == "deleted" else new_path

    diff_text = file_diff(vibe_repo, old_commit, new_commit, old_path, new_path).strip()
    new_content = None if status == "deleted" else show_file(vibe_repo, new_commit, new_path)
    old_content = show_file(vibe_repo, old_commit, old_path) if status == "deleted" else None

    parts = [
        f"# Update ESLint rule `{rule_name}` after a vibe-types knowledge update",
        "",
        "The vibe-types repo (jpablo/vibe-types) commit that this rule's "
        f"`knowledgeUrl(...)` points to moved from `{old_commit}` to `{new_commit}` "
        "on `main`. You do not have access to that repo from here, so the "
        "relevant source content is inlined below instead of a URL to fetch.",
        "",
        f"## Current rule file: `{rule_relpath}`",
        "",
        "```typescript",
        rule_file.read_text(encoding="utf-8"),
        "```",
        "",
    ]

    if status == "renamed":
        parts += [
            f"## Knowledge source `{knowledge_path}` — renamed upstream",
            f"This file was renamed from `{old_path}` to `{new_path}`. If you keep "
            "the rule, update its `knowledgeUrl(...)` path argument to the new path.",
            "",
        ]
    else:
        parts += [f"## Knowledge source `{knowledge_path}` — {status} upstream", ""]

    parts += [
        f"### Diff (`{old_commit[:12]}..{new_commit[:12]}`)",
        "",
        "```diff",
        diff_text if diff_text else "(no textual diff available)",
        "```",
        "",
    ]

    if new_content is not None:
        parts += [f"### Full new content of `{new_path}`", "", "```markdown", new_content, "```", ""]
    else:
        parts += [
            "### File deleted upstream",
            f"`{old_path}` no longer exists on `main`. Its last content, for reference:",
            "",
            "```markdown",
            old_content or "(unavailable)",
            "```",
            "",
        ]

    delete_clause = f", its test file `{test_relpath}`" if has_test else ""
    keep_clause = f" and it has a test file `{test_relpath}`" if has_test else ""
    parts += [
        "## What to do",
        "",
        "1. Read the diff and knowledge-source content above to understand what "
        "changed in the concept/pattern this rule enforces.",
        f"2. Decide whether `{rule_relpath}` still reflects the updated guidance:",
        "   - If the guidance changed (renamed pattern, revised recommendation, "
        "new caveats, changed terminology), update the rule's messages, comments, "
        "and/or detection logic to match it.",
        "   - If the concept was removed, merged into another, or superseded and "
        f"no longer justifies a distinct rule, delete `{rule_relpath}`{delete_clause}, "
        "and remove its import and registration entry from `src/index.ts`.",
        "   - If the upstream change is purely editorial (typos, rewording that "
        "doesn't change meaning), leave the rule as-is.",
        f"3. If you keep the rule{keep_clause}, update the test file so it still "
        "passes and reflects any changed wording or behavior.",
        "4. Don't change the `knowledgeUrl(...)` path/section arguments unless the "
        "diff shows the section heading itself was renamed — the pinned commit "
        "hash is centralized in `src/utils/knowledge-url.ts` and is updated "
        "separately by this script.",
        "",
    ]

    return "\n".join(parts)

# ── Harness invocation ────────────────────────────────────────────────────────

def invoke_harness(tool: str, prompt: str) -> int:
    if tool == "opencode":
        cmd = ["opencode", "run", prompt]
    else:
        cmd = ["claude", "--dangerously-skip-permissions", "-p", prompt]
    return subprocess.run(cmd, cwd=TARGET_REPO, check=False).returncode

# ── CLI ───────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Sync the pinned vibe-types commit and update affected rules")
    p.add_argument("--vibe-types-repo", type=Path, default=DEFAULT_VIBE_TYPES_REPO,
                   help="Path to a local clone of jpablo/vibe-types")
    p.add_argument("--tool", choices=["opencode", "claude"], default="opencode",
                   help="AI harness to invoke per matched rule")
    p.add_argument("--limit", type=int, default=None, help="Process at most N matched rules")
    p.add_argument("--rules", help="Comma-separated rule basenames to process (skips the rest)")
    p.add_argument("--dry-run", action="store_true",
                   help="Write prompt files but don't bump the pinned commit or invoke the harness")
    p.add_argument("--yes", action="store_true",
                   help="Skip the confirmation prompt before invoking the harness")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    vibe_repo = args.vibe_types_repo.expanduser().resolve()
    if not (vibe_repo / ".git").exists():
        sys.exit(f"error: {vibe_repo} is not a git repository")

    old_commit = read_pinned_commit()
    print(f"Pinned commit:  {old_commit}")

    print(f"Fetching origin/main in {vibe_repo}...")
    new_commit = resolve_main_commit(vibe_repo)
    print(f"main HEAD:      {new_commit}")

    if old_commit == new_commit:
        print("\nAlready up to date — nothing to do.")
        return

    changes = diff_knowledge_files(vibe_repo, old_commit, new_commit)
    rule_index = build_rule_index()
    matched = match_rules(changes, rule_index)

    print(f"\n{len(changes)} knowledge file(s) changed under catalog/usecases; "
          f"{len(matched)} rule(s) reference a changed file.")

    if args.rules:
        wanted = {name.strip() for name in args.rules.split(",") if name.strip()}
        matched = [(rf, c) for rf, c in matched if rf.stem in wanted]
        print(f"Filtered to --rules: {len(matched)} rule(s).")
    if args.limit is not None:
        matched = matched[: args.limit]
        print(f"Limited to --limit {args.limit}: {len(matched)} rule(s).")

    PROMPTS_DIR.mkdir(parents=True, exist_ok=True)
    prompts: list[tuple[Path, str]] = []
    for rule_file, change in matched:
        prompt = build_prompt(rule_file, change, vibe_repo, old_commit, new_commit)
        prompt_path = PROMPTS_DIR / f"{rule_file.stem}.md"
        prompt_path.write_text(prompt, encoding="utf-8")
        prompts.append((rule_file, prompt))
    if prompts:
        print(f"Wrote {len(prompts)} prompt file(s) to {PROMPTS_DIR.relative_to(TARGET_REPO)}/")

    if not prompts:
        print("\nNo rules matched — nothing to send to the harness.")
        if not args.dry_run:
            bump_pinned_commit(new_commit)
        return

    if args.dry_run:
        print(f"\n[dry-run] would invoke `{args.tool}` for {len(prompts)} rule(s); "
              f"pinned commit left at {old_commit}.")
        return

    preview = [rf.stem for rf, _ in prompts[:15]]
    print(f"\nAbout to invoke `{args.tool}` sequentially for {len(prompts)} rule(s):")
    for name in preview:
        print(f"  - {name}")
    if len(prompts) > len(preview):
        print(f"  ...and {len(prompts) - len(preview)} more "
              f"(see {PROMPTS_DIR.relative_to(TARGET_REPO)}/*.md for the full list)")

    if not args.yes:
        answer = input(f"\nProceed with {len(prompts)} harness invocation(s)? [y/N] ").strip().lower()
        if answer != "y":
            print(f"Aborted. Prompt files are kept in {PROMPTS_DIR.relative_to(TARGET_REPO)}/ "
                  "for manual use.")
            return

    bump_pinned_commit(new_commit)
    print()

    failures = []
    for idx, (rule_file, prompt) in enumerate(prompts, 1):
        print(f"[{idx}/{len(prompts)}] {rule_file.stem}")
        code = invoke_harness(args.tool, prompt)
        if code != 0:
            failures.append(rule_file.stem)
            print(f"  [!] {args.tool} exited with code {code}")

    print(f"\nDone. {len(prompts) - len(failures)}/{len(prompts)} succeeded.")
    if failures:
        print("Failed: " + ", ".join(failures))
        print("Review the changes, run `npm test` / `npm run typecheck`, and re-run "
              "with --rules for any that still need attention.")


if __name__ == "__main__":
    main()
