#!/usr/bin/env python3
"""
stack.py — orchestrates importing ESLint rules from vibe-types/eslint-plugin
into eslint-lensflow-plugin as a stacked PR series.

Usage:
  ./stack.py --phase branch   [--limit N] [--dry-run] [--verbose]
  ./stack.py --phase review   [--limit N] [--dry-run] [--verbose]
  ./stack.py --phase restack  [--dry-run] [--verbose]
  ./stack.py --phase merge    [--limit N] [--dry-run] [--verbose]
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

# ── Config ────────────────────────────────────────────────────────────────────

TARGET_REPO  = Path(__file__).resolve().parent
SOURCE_REPO  = Path(os.environ.get("SOURCE_REPO_PATH", "/home/alexeieleusis/development/vibe-types/eslint-plugin"))
GITHUB_REPO  = "alexeieleusis/lens-flow"
MAIN_BRANCH  = "main"

# ── Data types ────────────────────────────────────────────────────────────────

@dataclass
class WorkItem:
    branch: str                              # e.g. "rule/no-any-parameter"
    kind: Literal["utils", "rule", "register-rules"]
    rule_name: str = ""                      # e.g. "no-any-parameter"; empty for utils/register-rules

@dataclass
class ItemState:
    branched: bool = False
    pr_number: int | None = None
    pr_state: str | None = None              # "OPEN" | "MERGED" | "CLOSED"

# ── Shell runner ──────────────────────────────────────────────────────────────

class Runner:
    def __init__(self, dry_run: bool = False, verbose: bool = False):
        self.dry_run = dry_run
        self.verbose = verbose

    def run(self, cmd: list[str], cwd: Path | None = None,
            capture: bool = False) -> subprocess.CompletedProcess:
        if self.verbose or self.dry_run:
            loc = f"  [in {cwd}]" if cwd else ""
            print(f"  $ {' '.join(str(c) for c in cmd)}{loc}")
        if self.dry_run:
            return subprocess.CompletedProcess(cmd, 0, stdout="", stderr="")
        result = subprocess.run(
            cmd,
            cwd=cwd or TARGET_REPO,
            capture_output=capture,
            text=True,
        )
        if result.returncode != 0 and not capture:
            print(result.stderr, file=sys.stderr)
            sys.exit(result.returncode)
        return result

    def git(self, *args: str, cwd: Path | None = None,
            capture: bool = False) -> subprocess.CompletedProcess:
        return self.run(["git", *args], cwd=cwd, capture=capture)

    def gh(self, *args: str, capture: bool = False) -> subprocess.CompletedProcess:
        return self.run(["gh", *args], cwd=TARGET_REPO, capture=capture)

# ── Work list ─────────────────────────────────────────────────────────────────

UTILS_SKIP = {"rule-creator.ts"}   # already in target with correct URL

def build_work_list() -> list[WorkItem]:
    rules_dir = SOURCE_REPO / "src" / "rules"
    if not rules_dir.is_dir():
        print(f"Error: source rules directory not found: {rules_dir}", file=sys.stderr)
        print("Set the SOURCE_REPO_PATH environment variable to the correct path.", file=sys.stderr)
        sys.exit(1)
    rule_files = sorted((f.stem for f in rules_dir.iterdir() if f.suffix == ".ts"))

    items: list[WorkItem] = []

    # 1. utils
    items.append(WorkItem(branch="utils", kind="utils"))

    # 2. rules (alphabetical)
    for rule_name in rule_files:
        items.append(WorkItem(
            branch=f"rule/{rule_name}",
            kind="rule",
            rule_name=rule_name,
        ))

    # 3. register-rules
    items.append(WorkItem(branch="register-rules", kind="register-rules"))

    return items

# ── State ─────────────────────────────────────────────────────────────────────

def derive_state(
    items: list[WorkItem],
    raw_branches: str,        # stdout of: git branch -r
    raw_prs: str,             # stdout of: gh pr list --state all --json ...
) -> dict[str, ItemState]:
    remote_branches = {line.strip().removeprefix("origin/") for line in raw_branches.splitlines()}
    prs: list[dict] = json.loads(raw_prs) if raw_prs.strip() else []
    pr_by_branch = {pr["headRefName"]: pr for pr in prs}

    state: dict[str, ItemState] = {}
    for item in items:
        pr = pr_by_branch.get(item.branch)
        state[item.branch] = ItemState(
            branched=item.branch in remote_branches,
            pr_number=pr["number"] if pr else None,
            pr_state=pr["state"] if pr else None,
        )
    return state


def print_status(items: list[WorkItem], state: dict[str, ItemState], phase: str) -> None:
    total   = len(items)
    branched = sum(1 for i in items if state[i.branch].branched)
    open_prs = sum(1 for i in items if state[i.branch].pr_state == "OPEN")
    merged   = sum(1 for i in items if state[i.branch].pr_state == "MERGED")

    pending = [i for i in items if not state[i.branch].branched]
    next_item = pending[0].branch if pending else "(all branched)"

    print(f"\nPhase:    {phase}")
    print(f"Total:    {total}  (1 utils + {total-2} rules + 1 register-rules)")
    print(f"Branched: {branched}")
    print(f"PRs open: {open_prs}")
    print(f"Merged:   {merged}")
    print(f"Next:     {next_item}\n")

# ── Index generator ───────────────────────────────────────────────────────────

def to_camel_case(kebab: str) -> str:
    parts = kebab.split("-")
    return parts[0] + "".join(p.capitalize() for p in parts[1:])


def generate_index(rule_names: list[str]) -> str:
    imports = "\n".join(
        f'import {to_camel_case(name)} from "./rules/{name}";'
        for name in rule_names
    )
    if rule_names:
        rules_body = "\n".join(
            f'    "{name}": {to_camel_case(name)},'
            for name in rule_names
        )
        rules_obj = f"{{\n{rules_body}\n  }}"
    else:
        rules_obj = "{}"

    return f"""\
{imports}
import type {{ TSESLint }} from "@typescript-eslint/utils";

const plugin: {{
  rules: Record<string, TSESLint.RuleModule<string, unknown[]>>;
  configs: Record<string, unknown>;
}} = {{
  rules: {rules_obj},
  configs: {{}},
}};

export default plugin;
"""

# ── Phase: branch — file operations ───────────────────────────────────────────

def _parse_props(block: str) -> list[tuple[str, str]]:
    """Parse key: value pairs from an object literal, respecting nesting."""
    pairs: list[tuple[str, str]] = []
    i = 0
    while i < len(block):
        km = re.match(r'\s*(\w+)\s*:\s*', block[i:])
        if not km:
            break
        key = km.group(1)
        j = i + km.end()
        c = block[j]
        if c == '{':
            depth = 1
            j += 1
            while j < len(block) and depth > 0:
                if block[j] == '{':
                    depth += 1
                elif block[j] == '}':
                    depth -= 1
                j += 1
            val = block[i + km.end():j]
        elif c == '[':
            depth = 1
            j += 1
            while j < len(block) and depth > 0:
                if block[j] == '[':
                    depth += 1
                elif block[j] == ']':
                    depth -= 1
                j += 1
            val = block[i + km.end():j]
        elif c in ('"', "'"):
            q = c
            j += 1
            while j < len(block):
                if block[j] == '\\' and j + 1 < len(block):
                    j += 2
                    continue
                if block[j] == q:
                    j += 1
                    break
                j += 1
            val = block[i + km.end():j]
        else:
            em = re.match(r'([^,}]*)', block[j:])
            val = em.group(1) if em else ''
            j += len(val)
        pairs.append((key, val.strip()))
        while j < len(block) and block[j] == ',':
            j += 1
        i = j
    return pairs


def _infer_ts_type(val: str) -> str:
    """Infer a TypeScript type from a JS literal value string."""
    if val in ('true', 'false'):
        return 'boolean'
    if re.match(r'^-?\d+(\.\d+)?$', val):
        return 'number'
    if val.startswith(('"', "'")):
        return 'string'
    if val.startswith('['):
        return 'unknown[]'
    if val.startswith('{'):
        return 'object'
    return 'unknown'


def _infer_options_type(text: str) -> str:
    """Return a TS tuple type string for the rule's options, derived from defaultOptions."""
    dm = re.search(r'defaultOptions\s*:\s*\[\s*\{', text)
    if not dm:
        return '[]'
    brace_start = dm.end() - 1
    depth = 0
    i = brace_start
    while i < len(text):
        if text[i] == '{':
            depth += 1
        elif text[i] == '}':
            depth -= 1
            if depth == 0:
                break
        i += 1
    block = text[brace_start + 1:i]
    props = []
    for key, val in _parse_props(block):
        props.append(f'{key}: {_infer_ts_type(val)}')
    return '[{ ' + ', '.join(props) + ' }]' if props else '[]'


def patch_rule_file(path: Path) -> None:
    """Fix Node16/ESM compatibility issues in a copied rule or test file.

    Two issues arise when the source (CommonJS/Node) rules land in this repo
    (Node16/ESM):
      1. Relative imports need explicit .js extensions.
      2. TypeScript can't contextually type `create(context)` through the
         RuleCreator generics under strict Node16 settings, so we inject an
         explicit TSESLint.RuleContext annotation.
    """
    text = path.read_text(encoding="utf-8")
    original = text

    # Fix 1: add .js to relative imports that are missing a file extension.
    def _add_js_ext(m: re.Match) -> str:
        quote, imp = m.group(1), m.group(2)
        if not re.search(r'\.[a-zA-Z]+$', imp):
            imp += '.js'
        return f'from {quote}{imp}{quote}'

    text = re.sub(r'from (["\'])(\.\.?/[^\'"]+)\1', _add_js_ext, text)

    # Fix 2: annotate create(context) with an explicit TSESLint.RuleContext type.
    if re.search(r'\bcreate\(context\)\s*\{', text):
        # Primary: collect message IDs from context.report() calls in this file.
        msg_ids = list(dict.fromkeys(re.findall(r'messageId:\s*["\'](\w+)["\']', text)))

        # Fallback: parse the messages: { ... } block.  We need string-aware
        # brace counting because message values contain {{template}} braces.
        if not msg_ids:
            m = re.search(r'messages:\s*\{', text)
            if m:
                depth, in_str, str_char, i = 1, False, '', m.end()
                while i < len(text) and depth > 0:
                    c = text[i]
                    if in_str:
                        if c == '\\':
                            i += 1
                        elif c == str_char:
                            in_str = False
                    else:
                        if c in ('"', "'", '`'):
                            in_str, str_char = True, c
                        elif c == '{':
                            depth += 1
                        elif c == '}':
                            depth -= 1
                    i += 1
                block = text[m.end():i - 1]
                msg_ids = list(dict.fromkeys(
                    re.findall(r'^\s*([a-zA-Z_$][\w$]*)\s*:', block, re.MULTILINE)
                ))

        if msg_ids:
            msg_union = ' | '.join(f'"{mid}"' for mid in msg_ids)

            if not re.search(r'import\b.*\bTSESLint\b', text):
                # Amend an existing @typescript-eslint/utils import if present...
                patched = re.sub(
                    r'(import(?:\s+type)?\s*\{)([^}]+?)(\}\s*from\s*["\']@typescript-eslint/utils["\'])',
                    lambda m: m.group(1) + m.group(2).rstrip() + ', TSESLint ' + m.group(3),
                    text, count=1,
                )
                if patched == text:
                    # ...otherwise add one after the rule-creator import line.
                    patched = re.sub(
                        r'(import \{ createRule \} from ["\']\.\.\/utils\/rule-creator\.js["\'];)',
                        r'\1\nimport type { TSESLint } from "@typescript-eslint/utils";',
                        text, count=1,
                    )
                text = patched

            opts_type = _infer_options_type(text)
            text = re.sub(
                r'\bcreate\(context\)\s*\{',
                f'create(context: TSESLint.RuleContext<{msg_union}, {opts_type}>) {{',
                text, count=1,
            )

    if text != original:
        path.write_text(text, encoding="utf-8")
        print(f"  patched {path.name}")


def copy_utils(runner: Runner) -> None:
    src_utils = SOURCE_REPO / "src" / "utils"
    dst_utils = TARGET_REPO / "src" / "utils"
    dst_utils.mkdir(parents=True, exist_ok=True)
    for f in src_utils.iterdir():
        if f.name not in UTILS_SKIP:
            if runner.dry_run:
                print(f"  [dry-run] would copy {f.name}")
            else:
                shutil.copy2(f, dst_utils / f.name)
                print(f"  copied {f.name}")


def copy_rule(rule_name: str, runner: Runner) -> None:
    src_rule = SOURCE_REPO / "src" / "rules" / f"{rule_name}.ts"
    dst_rule = TARGET_REPO / "src" / "rules" / f"{rule_name}.ts"
    dst_rule.parent.mkdir(parents=True, exist_ok=True)

    src_test = SOURCE_REPO / "tests" / "rules" / f"{rule_name}.test.ts"
    dst_test = TARGET_REPO / "tests" / "rules" / f"{rule_name}.test.ts"
    dst_test.parent.mkdir(parents=True, exist_ok=True)

    if runner.dry_run:
        print(f"  [dry-run] would copy rule + test: {rule_name}")
    else:
        shutil.copy2(src_rule, dst_rule)
        shutil.copy2(src_test, dst_test)
        print(f"  copied rule + test: {rule_name}")


def run_checks(rule_name: str, runner: Runner) -> bool:
    """Run npm test + typecheck. On failure, invoke opencode once and retry.
    Returns True on success, False if still failing after retry."""
    result = subprocess.run(
        "npm test && npm run typecheck",
        shell=True, cwd=TARGET_REPO, capture_output=True, text=True
    )
    if result.returncode == 0:
        return True

    error_output = result.stdout + result.stderr
    prompt = (
        f"You are working in the eslint-lensflow-plugin project. "
        f"After copying rule '{rule_name}', the build/tests failed with:\n\n"
        f"{error_output}\n\nPlease fix the issue."
    )
    print(f"  [!] checks failed — invoking opencode to fix...")
    if not runner.dry_run:
        subprocess.run(["opencode", "run", prompt], cwd=TARGET_REPO, check=False)

    retry = subprocess.run(
        "npm test && npm run typecheck",
        shell=True, cwd=TARGET_REPO, capture_output=True, text=True
    )
    return retry.returncode == 0


def write_register_rules(runner: Runner) -> None:
    rules_dir = TARGET_REPO / "src" / "rules"
    rule_names = sorted(f.stem for f in rules_dir.iterdir() if f.suffix == ".ts")
    content = generate_index(rule_names)
    index_path = TARGET_REPO / "src" / "index.ts"
    if runner.dry_run:
        print(f"  [dry-run] would write src/index.ts with {len(rule_names)} rules")
    else:
        index_path.write_text(content, encoding="utf-8")
        print(f"  wrote src/index.ts with {len(rule_names)} rules")

# ── Phase: branch ─────────────────────────────────────────────────────────────

def local_branch_exists(branch: str) -> bool:
    result = subprocess.run(
        ["git", "rev-parse", "--verify", f"refs/heads/{branch}"],
        cwd=TARGET_REPO, capture_output=True, text=True
    )
    return result.returncode == 0

def pr_title(item: WorkItem) -> str:
    if item.kind == "utils":
        return "feat: add shared utility files"
    if item.kind == "register-rules":
        return "feat: register all rules in plugin index"
    return f"feat: add rule {item.rule_name}"


def pr_body(item: WorkItem) -> str:
    if item.kind == "utils":
        return "Adds the shared utility files used by all rules."
    if item.kind == "register-rules":
        return "Registers all imported rules in `src/index.ts`."
    return (
        f"Adds ESLint rule `{item.rule_name}`.\n\n"
        f"Imported from [vibe-types/eslint-plugin](https://github.com/jpablo/vibe-types)."
    )


def phase_branch(
    items: list[WorkItem],
    state: dict[str, ItemState],
    runner: Runner,
    limit: int | None,
) -> None:
    # Process items that are missing either the branch or the PR
    def needs_work(i: WorkItem) -> bool:
        s = state[i.branch]
        return not s.branched or s.pr_number is None

    pending = [i for i in items if needs_work(i)]
    if limit is not None:
        pending = pending[:limit]

    if not pending:
        print("Nothing to do — all items already branched and have PRs.")
        return

    pending_branches = {i.branch for i in pending}

    for item_idx, item in enumerate(items):
        if item.branch not in pending_branches:
            continue

        prev_branch = items[item_idx - 1].branch if item_idx > 0 else MAIN_BRANCH
        item_state = state[item.branch]

        print(f"\n[{item_idx+1}/{len(items)}] {item.branch}")

        # Steps 1-5: only needed if branch not yet pushed
        if not item_state.branched:
            branch_local = local_branch_exists(item.branch) if not runner.dry_run else False

            if not branch_local:
                # 1. Checkout new branch
                runner.git("checkout", "-b", item.branch, prev_branch)

                # 2. Copy files
                if item.kind == "utils":
                    copy_utils(runner)
                elif item.kind == "rule":
                    copy_rule(item.rule_name, runner)
                elif item.kind == "register-rules":
                    write_register_rules(runner)

                # 3. Check build
                if not runner.dry_run:
                    ok = run_checks(item.rule_name or item.kind, runner)
                    if not ok:
                        print(f"  [!!] still failing after opencode retry — stopping.")
                        print(f"  Branch '{item.branch}' left in place for inspection.")
                        sys.exit(1)

                # 4. Commit
                has_changes = subprocess.run(
                    ["git", "status", "--porcelain"],
                    cwd=TARGET_REPO, capture_output=True, text=True
                ).stdout.strip()

                if has_changes or runner.dry_run:
                    runner.git("add", "-A")
                    runner.git("commit", "-m", pr_title(item))
                else:
                    print("  (nothing to commit — skipping)")
            else:
                print("  branch exists locally — skipping setup, will push")
                runner.git("checkout", item.branch)

            # 5. Push + track
            runner.git("push", "-u", "origin", item.branch)
            runner.run(["git-spice", "btr"], cwd=TARGET_REPO)
        else:
            print("  branch already pushed — skipping to PR creation")
            runner.git("checkout", item.branch)

        # 6. Create PR (only if it doesn't exist yet)
        if item_state.pr_number is None:
            result = runner.gh(
                "pr", "create",
                "--base", prev_branch,
                "--title", pr_title(item),
                "--body", pr_body(item),
                "--reviewer", "copilot",
                "--repo", GITHUB_REPO,
                capture=True,
            )
            pr_url = result.stdout.strip() if result.stdout else ""
            print(f"  PR: {pr_url}")
        else:
            print(f"  PR #{item_state.pr_number} already exists — skipping creation")

# ── Phase: review ─────────────────────────────────────────────────────────────

def build_review_prompt(
    rule_name: str,
    file_path: str,
    line: int | None,
    comment_body: str,
) -> str:
    location = file_path + (f" line {line}" if line else "")
    return (
        f"You are working in the eslint-lensflow-plugin project on rule '{rule_name}'. "
        f"A code reviewer left the following comment at {location}:\n\n"
        f"\"{comment_body}\"\n\nPlease address this comment by modifying the relevant file(s)."
    )


def resolve_thread(thread_id: str, runner: Runner) -> None:
    mutation = (
        'mutation { resolveReviewThread(input: {threadId: "'
        + thread_id
        + '"}) { thread { id isResolved } } }'
    )
    runner.gh("api", "graphql", "-f", f"query={mutation}")


def rerequest_review(pr_number: int, runner: Runner) -> None:
    print(f"  re-requesting Copilot review for PR #{pr_number}")
    runner.gh(
        "pr", "edit", str(pr_number),
        "--add-reviewer", "copilot",
        "--repo", GITHUB_REPO,
        capture=True,
    )


_REVIEW_THREADS_QUERY = """
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      reviewThreads(first: 100) {
        nodes {
          id
          isResolved
          comments(first: 10) {
            nodes { body path line }
          }
        }
      }
    }
  }
}
""".strip()


def fetch_unresolved_threads(pr_number: int, runner: Runner) -> list[dict]:
    owner, repo = GITHUB_REPO.split("/")
    result = runner.gh(
        "api", "graphql",
        "-f", f"query={_REVIEW_THREADS_QUERY}",
        "-f", f"owner={owner}",
        "-f", f"name={repo}",
        "-F", f"number={pr_number}",
        capture=True,
    )
    if runner.dry_run:
        return []
    if result.returncode != 0 or not result.stdout.strip():
        print(f"  warning: failed to fetch review threads: {result.stderr.strip()}")
        return []
    data = json.loads(result.stdout)
    pr = data["data"]["repository"]["pullRequest"]
    if not pr:
        print(f"  warning: PR #{pr_number} not found or inaccessible")
        return []
    nodes = pr["reviewThreads"]["nodes"]
    return [t for t in nodes if not t.get("isResolved", True)]


def phase_review(
    items: list[WorkItem],
    state: dict[str, ItemState],
    runner: Runner,
    limit: int | None,
) -> None:
    candidates = [
        i for i in items
        if state[i.branch].pr_number is not None
        and state[i.branch].pr_state == "OPEN"
    ]

    if not candidates:
        print("No open PRs to review.")
        return

    for idx, item in enumerate(candidates):
        if limit is not None and idx >= limit:
            break
        pr_number = state[item.branch].pr_number
        print(f"\n[review] {item.branch} (PR #{pr_number})")

        # Fetch review threads via GraphQL
        threads = fetch_unresolved_threads(pr_number, runner)
        if runner.dry_run:
            print("  (dry-run: skipping thread processing)")
            continue

        if not threads:
            print("  no unresolved threads — skipping")
            continue

        runner.git("checkout", item.branch)

        for thread in threads:
            nodes = thread["comments"].get("nodes", [])
            if not nodes:
                continue
            first_comment = nodes[0]
            prompt = build_review_prompt(
                rule_name=item.rule_name or item.kind,
                file_path=first_comment.get("path", ""),
                line=first_comment.get("line"),
                comment_body=first_comment.get("body", ""),
            )
            print(f"  opencode: {first_comment.get('path', '')} — {first_comment.get('body', '')[:60]}…")
            subprocess.run(["opencode", "run", prompt], cwd=TARGET_REPO, check=False)

        # Commit if there are changes
        changed = subprocess.run(
            ["git", "status", "--porcelain"],
            cwd=TARGET_REPO, capture_output=True, text=True
        ).stdout.strip()

        if changed:
            runner.git("add", "-A")
            runner.git("commit", "-m", "review: address copilot comments")
            runner.git("push", "--force-with-lease")
            for thread in threads:
                resolve_thread(thread["id"], runner)
                print(f"  resolved thread {thread['id'][:20]}…")
        else:
            print("  (opencode made no changes)")

# ── Phase: restack ────────────────────────────────────────────────────────────

def phase_restack(items: list[WorkItem], runner: Runner) -> None:
    print(f"Checking out base branch: utils")
    runner.git("checkout", "utils")
    runner.run(["git-spice", "upstack", "restack"], cwd=TARGET_REPO)

    remaining = [i for i in items if i.branch != MAIN_BRANCH]
    for item in remaining:
        runner.git("push", "--force-with-lease", "origin", item.branch)
        print(f"  force-pushed {item.branch}")


# ── Phase: merge ──────────────────────────────────────────────────────────────

def make_rebase_onto_cmd(tip_sha: str, next_branch: str) -> list[str]:
    return ["git", "rebase", "--onto", MAIN_BRANCH, tip_sha, next_branch]


def phase_merge(
    items: list[WorkItem],
    state: dict[str, ItemState],
    runner: Runner,
    limit: int | None,
) -> None:
    pending = [
        i for i in items
        if state[i.branch].pr_state not in ("MERGED", "CLOSED", None)
    ]
    if limit is not None:
        pending = pending[:limit]

    if not pending:
        print("Nothing to merge.")
        return

    for item in pending:
        pr_number = state[item.branch].pr_number
        print(f"\n[merge] {item.branch} (PR #{pr_number})")

        # Re-check mergeability
        result = runner.gh(
            "pr", "view", str(pr_number),
            "--json", "state,mergeable,statusCheckRollup",
            "--repo", GITHUB_REPO,
            capture=True,
        )
        if not runner.dry_run:
            info = json.loads(result.stdout)
            if info["state"] == "MERGED":
                print("  already merged — skipping")
                continue
            if info.get("mergeable") != "MERGEABLE":
                print(f"  not mergeable ({info.get('mergeable')}) — skipping")
                continue

        # Capture tip SHA before merge deletes the branch label
        tip_result = runner.git("rev-parse", item.branch, capture=True)
        tip_sha = tip_result.stdout.strip() if not runner.dry_run else "dry-run-sha"

        # Squash merge
        runner.gh(
            "pr", "merge", str(pr_number),
            "--squash", "--delete-branch",
            "--repo", GITHUB_REPO,
        )
        runner.git("fetch", "origin")
        runner.git("pull", "origin", MAIN_BRANCH)

        # Rebase next branch onto main
        item_idx = items.index(item)
        next_items = items[item_idx + 1:]
        if next_items:
            next_item = next_items[0]
            runner.git("checkout", next_item.branch)
            runner.run(
                make_rebase_onto_cmd(tip_sha, next_item.branch),
                cwd=TARGET_REPO,
            )
            if state[next_item.branch].pr_number is not None:
                runner.gh(
                    "pr", "edit", str(state[next_item.branch].pr_number),
                    "--base", MAIN_BRANCH,
                    "--repo", GITHUB_REPO,
                )
            runner.git("push", "--force-with-lease", "origin", next_item.branch)


# ── CLI ───────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Stacked-PR rule import orchestrator")
    p.add_argument("--phase", required=True,
                   choices=["branch", "review", "restack", "merge"])
    p.add_argument("--limit", type=int, default=None,
                   help="Process at most N items this run")
    p.add_argument("--dry-run", action="store_true",
                   help="Print actions without executing them")
    p.add_argument("--verbose", action="store_true",
                   help="Show full command output")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    runner = Runner(dry_run=args.dry_run, verbose=args.verbose)

    items = build_work_list()

    branches_result = subprocess.run(
        ["git", "branch", "-r"],
        cwd=TARGET_REPO, capture_output=True, text=True
    )
    prs_result = subprocess.run(
        ["gh", "pr", "list",
         "--state", "all",
         "--limit", "400",
         "--json", "number,headRefName,state",
         "--repo", GITHUB_REPO],
        cwd=TARGET_REPO, capture_output=True, text=True
    )

    raw_branches = branches_result.stdout if branches_result.returncode == 0 else ""
    raw_prs = prs_result.stdout if prs_result.returncode == 0 else ""

    state = derive_state(items, raw_branches, raw_prs)
    print_status(items, state, args.phase)

    if args.phase == "branch":
        phase_branch(items, state, runner, args.limit)
    elif args.phase == "review":
        phase_review(items, state, runner, args.limit)
    elif args.phase == "restack":
        phase_restack(items, runner)
    elif args.phase == "merge":
        phase_merge(items, state, runner, args.limit)


if __name__ == "__main__":
    main()
