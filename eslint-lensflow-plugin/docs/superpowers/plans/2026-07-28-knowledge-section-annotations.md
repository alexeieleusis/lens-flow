# Knowledge-Section Annotations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `knowledgeUrl()` accept an optional `section` argument, and build `~/scripts/add_knowledge_sections.py` — a script that uses `opencode run` to determine, for each of the 282 rules in `eslint-lensflow-plugin/src/rules/`, which heading/example in its knowledge markdown file the rule's rationale comes from, and add that as the second argument to the rule's existing `knowledgeUrl(...)` call.

**Architecture:** One small TypeScript change (`src/utils/knowledge-url.ts` grows an optional second parameter, non-breaking for all 282 existing call sites) plus a two-phase CLI script (`--build-map` then `--apply`), following the `Runner`-class + `argparse` conventions already established in `~/scripts/restore_help_urls.py` and `~/scripts/rewrite_rule_branches.py`. Phase 1 is pure classification logic writing a JSON map to disk; Phase 2 replays that map through `opencode run` with a bounded per-file retry-and-verify loop, committing one fix per file.

**Tech Stack:** TypeScript/vitest for the `knowledgeUrl()` change. Python 3 (stdlib only: `argparse`, `json`, `re`, `subprocess`, `pathlib`, `typing`), `pytest` for the script and its tests, `opencode` CLI (already installed at `~/.opencode/bin/opencode`), the repo's own `npm run typecheck` / `npx vitest` for verification.

## Global Constraints

- Full design context: `docs/superpowers/specs/2026-07-28-knowledge-section-annotations-design.md`.
- Script and its test file live in `~/scripts/`: `add_knowledge_sections.py` and `test_add_knowledge_sections.py`, matching the location and style of the existing sibling scripts there (`restore_help_urls.py` in particular).
- `REPO_DIR = Path("/home/alexeieleusis/second_ssd/development/lensflow/eslint-lensflow-plugin")`, `GIT_ROOT = REPO_DIR.parent`, `VIBE_TYPES_DIR = Path("/home/alexeieleusis/second_ssd/development/vibe-types/plugin/skills/typescript")`. `git` commands run with `cwd=GIT_ROOT` (so `git add`/`git commit`/`git restore` paths must be given relative to `GIT_ROOT`, i.e. prefixed with `eslint-lensflow-plugin/`); `npm`/`npx`/`opencode` commands run with `cwd=REPO_DIR`.
- The `knowledgeUrl()` constant's name is **not** standardized by this project — it stays whatever it already is per rule file (`URL`, `RULE_URL`, `RULE_DOCS_URL`, `DOCS_URL`, `DOC_URL`, `KNOWLEDGE_URL`, `DISCRIMINANT_DOC_URL` all occur today). The script locates the `knowledgeUrl(` call itself via regex, never a constant name.
- Every rule file currently has exactly one `knowledgeUrl(` call (verified: no file has more than one occurrence), so there is no multi-call disambiguation to handle.
- Commit message for each per-file fix: `fix: add knowledge section to <rule-name>`.
- Retry budget per file: 3 attempts (configurable via `--max-retries`) before reverting that file and logging it to `needs-section-review.txt`, never aborting the whole run.
- No test-file mocking libraries beyond what's already used in `test_restore_help_urls.py` (plain `pytest`, `capsys`, `monkeypatch`, dependency-injected callables/`dry_run`) — keep the same lightweight testing style already established in `~/scripts/`.
- `section` is an **optional** parameter on `knowledgeUrl()` during the migration (default: omit the suffix) specifically so that files not yet migrated keep typechecking while the script works through the other 281 — this is an implementation detail, not a change to the approved design (which specifies the two-argument, combined-string call as the *end state* every rule converges to).

---

### Task 1: `knowledgeUrl()` grows an optional `section` parameter

**Files:**

- Modify: `src/utils/knowledge-url.ts`
- Create: `tests/utils/knowledge-url.test.ts`

**Interfaces:**

- Produces: `knowledgeUrl(path: string, section?: string): string`.

- [ ] **Step 1: Write the failing test**

Create `tests/utils/knowledge-url.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { knowledgeUrl } from "../../src/utils/knowledge-url.js";

describe("knowledgeUrl", () => {
  it("returns the bare URL when no section is given", () => {
    expect(knowledgeUrl("catalog/T47-gradual-typing.md")).toBe(
      "https://raw.githubusercontent.com/jpablo/vibe-types/" +
        "7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/" +
        "catalog/T47-gradual-typing.md",
    );
  });

  it("appends the section as a human-readable suffix when given", () => {
    expect(
      knowledgeUrl(
        "catalog/T47-gradual-typing.md",
        "Antipattern A — any to bypass type errors",
      ),
    ).toBe(
      "https://raw.githubusercontent.com/jpablo/vibe-types/" +
        "7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/" +
        'catalog/T47-gradual-typing.md (see: "Antipattern A — any to bypass type errors")',
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/utils/knowledge-url.test.ts`
Expected: FAIL on the second test (`appends the section...`) — the current implementation ignores any second argument and always returns the bare URL, so the suffixed string won't match.

- [ ] **Step 3: Write the implementation**

Replace the contents of `src/utils/knowledge-url.ts`:

```ts
const COMMIT = "7891def9e1b66bebd95a393b42f3401eba697cd5";
const BASE = `https://raw.githubusercontent.com/jpablo/vibe-types/${COMMIT}/plugin/skills/typescript/`;

export function knowledgeUrl(path: string, section?: string): string {
  return section ? `${BASE}${path} (see: "${section}")` : `${BASE}${path}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/utils/knowledge-url.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Run typecheck to confirm all 282 existing one-argument call sites still compile**

Run: `npm run typecheck`
Expected: PASS (no errors — `section` is optional, so `knowledgeUrl("some/path.md")` remains valid everywhere it's already called that way)

- [ ] **Step 6: Commit**

```bash
git add src/utils/knowledge-url.ts tests/utils/knowledge-url.test.ts
git commit -m "feat: add optional section parameter to knowledgeUrl"
```

---

### Task 2: Knowledge-path extraction and pending-detection helpers

**Files:**

- Create: `/home/alexeieleusis/scripts/add_knowledge_sections.py`
- Create: `/home/alexeieleusis/scripts/test_add_knowledge_sections.py`

**Interfaces:**

- Produces: `extract_knowledge_path(text: str) -> str | None`, `is_pending(text: str) -> bool`.

- [ ] **Step 1: Write the failing tests**

Create `/home/alexeieleusis/scripts/test_add_knowledge_sections.py`:

```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from add_knowledge_sections import extract_knowledge_path, is_pending


# ── extract_knowledge_path ───────────────────────────────────────────────────

def test_extract_knowledge_path_single_arg():
    text = 'const URL = knowledgeUrl("catalog/T47-gradual-typing.md");'
    assert extract_knowledge_path(text) == "catalog/T47-gradual-typing.md"


def test_extract_knowledge_path_two_arg():
    text = (
        'const URL = knowledgeUrl(\n'
        '  "catalog/T47-gradual-typing.md",\n'
        '  "Antipattern A — any to bypass type errors",\n'
        ');'
    )
    assert extract_knowledge_path(text) == "catalog/T47-gradual-typing.md"


def test_extract_knowledge_path_absent():
    assert extract_knowledge_path("const x = 1;") is None


# ── is_pending ────────────────────────────────────────────────────────────────

def test_is_pending_true_for_single_line_single_arg():
    text = 'const URL = knowledgeUrl("catalog/T47-gradual-typing.md");'
    assert is_pending(text) is True


def test_is_pending_true_for_multiline_single_arg_trailing_comma():
    text = (
        'const URL = knowledgeUrl(\n'
        '  "catalog/T47-gradual-typing.md",\n'
        ');'
    )
    assert is_pending(text) is True


def test_is_pending_false_for_two_arg():
    text = (
        'const URL = knowledgeUrl(\n'
        '  "catalog/T47-gradual-typing.md",\n'
        '  "Antipattern A — any to bypass type errors",\n'
        ');'
    )
    assert is_pending(text) is False


def test_is_pending_false_for_absent():
    assert is_pending("const x = 1;") is False
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ~/scripts && python3 -m pytest test_add_knowledge_sections.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'add_knowledge_sections'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `/home/alexeieleusis/scripts/add_knowledge_sections.py`:

```python
#!/usr/bin/env python3
"""
add_knowledge_sections.py — for every rule in eslint-lensflow-plugin/src/rules/
that links to a knowledge markdown file via a single-argument knowledgeUrl(path)
call, use `opencode run` to determine which heading/example in that knowledge
file the rule's rationale comes from, and add it as a second argument:
knowledgeUrl(path, section).

Usage:
  ./add_knowledge_sections.py --build-map [--map-path PATH]
  ./add_knowledge_sections.py --apply [--map-path PATH] [--start NAME] [--end NAME]
                               [--max-retries N] [--dry-run] [--verbose]
"""

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Callable

REPO_DIR = Path("/home/alexeieleusis/second_ssd/development/lensflow/eslint-lensflow-plugin")
GIT_ROOT = REPO_DIR.parent
VIBE_TYPES_DIR = Path(
    "/home/alexeieleusis/second_ssd/development/vibe-types/plugin/skills/typescript"
)

KNOWLEDGE_URL_ONE_ARG_RE = re.compile(r'knowledgeUrl\(\s*"([^"]+)"\s*,?\s*\)')
KNOWLEDGE_URL_ANY_CALL_RE = re.compile(r'knowledgeUrl\(\s*"([^"]+)"')


def extract_knowledge_path(text: str) -> str | None:
    m = KNOWLEDGE_URL_ANY_CALL_RE.search(text)
    return m.group(1) if m else None


def is_pending(text: str) -> bool:
    return bool(KNOWLEDGE_URL_ONE_ARG_RE.search(text))


if __name__ == "__main__":
    pass
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ~/scripts && python3 -m pytest test_add_knowledge_sections.py -v`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
cd ~/scripts
git add add_knowledge_sections.py test_add_knowledge_sections.py
git commit -m "feat: add knowledge-path extraction and pending-detection helpers"
```

---

### Task 3: `build_map` orchestration + `--build-map` CLI

**Files:**

- Modify: `/home/alexeieleusis/scripts/add_knowledge_sections.py`
- Modify: `/home/alexeieleusis/scripts/test_add_knowledge_sections.py`

**Interfaces:**

- Consumes: `extract_knowledge_path`, `is_pending` (Task 2).
- Produces: `build_map(repo_dir: Path, vibe_types_dir: Path, out_path: Path) -> list[dict]`. Each dict: `{"rule": str, "knowledge_path": str}`.

- [ ] **Step 1: Write the failing tests**

Append to `/home/alexeieleusis/scripts/test_add_knowledge_sections.py`:

```python
import json
from add_knowledge_sections import build_map


def test_build_map_includes_pending_with_existing_knowledge_file(tmp_path):
    rules_dir = tmp_path / "repo" / "src" / "rules"
    rules_dir.mkdir(parents=True)
    vibe_dir = tmp_path / "vibe"
    (vibe_dir / "catalog").mkdir(parents=True)
    (vibe_dir / "catalog" / "T47-gradual-typing.md").write_text("# doc", encoding="utf-8")

    (rules_dir / "no-any-parameter.ts").write_text(
        'const URL = knowledgeUrl("catalog/T47-gradual-typing.md");\n', encoding="utf-8",
    )

    out_path = tmp_path / "map.json"
    entries = build_map(tmp_path / "repo", vibe_dir, out_path)

    assert entries == [
        {"rule": "no-any-parameter", "knowledge_path": "catalog/T47-gradual-typing.md"}
    ]
    assert json.loads(out_path.read_text(encoding="utf-8")) == entries


def test_build_map_skips_already_done_files(tmp_path):
    rules_dir = tmp_path / "repo" / "src" / "rules"
    rules_dir.mkdir(parents=True)
    vibe_dir = tmp_path / "vibe"
    vibe_dir.mkdir(parents=True)

    (rules_dir / "already-done.ts").write_text(
        'const URL = knowledgeUrl(\n'
        '  "catalog/T47-gradual-typing.md",\n'
        '  "Antipattern A",\n'
        ');\n',
        encoding="utf-8",
    )

    entries = build_map(tmp_path / "repo", vibe_dir, tmp_path / "map.json")

    assert entries == []


def test_build_map_skips_and_warns_when_knowledge_file_missing(tmp_path, capsys):
    rules_dir = tmp_path / "repo" / "src" / "rules"
    rules_dir.mkdir(parents=True)
    vibe_dir = tmp_path / "vibe"
    vibe_dir.mkdir(parents=True)

    (rules_dir / "no-such-doc.ts").write_text(
        'const URL = knowledgeUrl("catalog/does-not-exist.md");\n', encoding="utf-8",
    )

    entries = build_map(tmp_path / "repo", vibe_dir, tmp_path / "map.json")

    assert entries == []
    captured = capsys.readouterr()
    assert "no-such-doc" in captured.err
    assert "does-not-exist.md" in captured.err
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ~/scripts && python3 -m pytest test_add_knowledge_sections.py -v`
Expected: FAIL with `ImportError: cannot import name 'build_map'`

- [ ] **Step 3: Write the implementation**

Add to `/home/alexeieleusis/scripts/add_knowledge_sections.py`, after `is_pending`:

```python
def build_map(repo_dir: Path, vibe_types_dir: Path, out_path: Path) -> list[dict]:
    rules_dir = repo_dir / "src" / "rules"
    entries: list[dict] = []

    for rule_file in sorted(rules_dir.glob("*.ts")):
        rule_name = rule_file.stem
        text = rule_file.read_text(encoding="utf-8")

        if not is_pending(text):
            continue

        knowledge_path = extract_knowledge_path(text)
        if knowledge_path is None:
            print(f"  [warn] no knowledgeUrl(...) call found in {rule_name}", file=sys.stderr)
            continue

        if not (vibe_types_dir / knowledge_path).exists():
            print(
                f"  [warn] knowledge file not found for {rule_name}: {knowledge_path}",
                file=sys.stderr,
            )
            continue

        entries.append({"rule": rule_name, "knowledge_path": knowledge_path})

    out_path.write_text(json.dumps(entries, indent=2) + "\n", encoding="utf-8")
    return entries
```

Replace the `if __name__ == "__main__": pass` block at the bottom with:

```python
def main() -> None:
    p = argparse.ArgumentParser(
        description="Add knowledge-section annotations to knowledgeUrl() calls "
        "across eslint-lensflow-plugin/src/rules/*.ts"
    )
    p.add_argument("--build-map", action="store_true",
                    help="Scan src/rules/, write the map JSON, and exit")
    p.add_argument("--map-path", default="knowledge-sections-map.json", metavar="PATH",
                    help="Path to the map JSON file (default: knowledge-sections-map.json)")
    args = p.parse_args()

    map_path = Path(args.map_path)

    if args.build_map:
        entries = build_map(REPO_DIR, VIBE_TYPES_DIR, map_path)
        print(f"Wrote {len(entries)} entries to {map_path}")
        return

    p.print_help()


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ~/scripts && python3 -m pytest test_add_knowledge_sections.py -v`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
cd ~/scripts
git add add_knowledge_sections.py test_add_knowledge_sections.py
git commit -m "feat: add build_map orchestration and --build-map CLI"
```

---

### Task 4: `Runner` class with git/npm/npx/opencode wrappers

**Files:**

- Modify: `/home/alexeieleusis/scripts/add_knowledge_sections.py`
- Modify: `/home/alexeieleusis/scripts/test_add_knowledge_sections.py`

**Interfaces:**

- Produces: `Runner(dry_run: bool = False, verbose: bool = False)` with methods `run(cmd, capture=False, check=True, cwd=None)`, `git(*args, capture=False, check=True)`, `npm(*args, capture=False, check=True)`, `npx(*args, capture=False, check=True)`, `opencode(prompt: str)`.

- [ ] **Step 1: Write the failing tests**

Append to `/home/alexeieleusis/scripts/test_add_knowledge_sections.py`:

```python
from add_knowledge_sections import Runner


def test_runner_dry_run_does_not_execute(capsys):
    r = Runner(dry_run=True)
    result = r.run(["false"])
    assert result.returncode == 0
    captured = capsys.readouterr()
    assert "false" in captured.out


def test_runner_git_prepends_git(capsys):
    r = Runner(dry_run=True)
    r.git("status")
    captured = capsys.readouterr()
    assert "git status" in captured.out


def test_runner_npm_prepends_npm(capsys):
    r = Runner(dry_run=True)
    r.npm("run", "typecheck")
    captured = capsys.readouterr()
    assert "npm run typecheck" in captured.out


def test_runner_npx_prepends_npx(capsys):
    r = Runner(dry_run=True)
    r.npx("vitest", "run", "tests/rules/foo.test.ts")
    captured = capsys.readouterr()
    assert "npx vitest run tests/rules/foo.test.ts" in captured.out


def test_runner_opencode_invokes_run_with_prompt(capsys):
    r = Runner(dry_run=True)
    r.opencode("fix the thing")
    captured = capsys.readouterr()
    assert "opencode run fix the thing" in captured.out
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ~/scripts && python3 -m pytest test_add_knowledge_sections.py -v`
Expected: FAIL with `ImportError: cannot import name 'Runner'`

- [ ] **Step 3: Write the implementation**

Add to `/home/alexeieleusis/scripts/add_knowledge_sections.py`, after `build_map`:

```python
class Runner:
    def __init__(self, dry_run: bool = False, verbose: bool = False) -> None:
        self.dry_run = dry_run
        self.verbose = verbose

    def run(
        self,
        cmd: list[str],
        capture: bool = False,
        check: bool = True,
        cwd: Path | None = None,
    ) -> subprocess.CompletedProcess:
        if self.verbose or self.dry_run:
            print(f"  $ {' '.join(str(c) for c in cmd)}")
        if self.dry_run:
            return subprocess.CompletedProcess(cmd, 0, stdout="", stderr="")
        result = subprocess.run(
            cmd, cwd=cwd or GIT_ROOT, capture_output=capture, text=True,
        )
        if check and result.returncode != 0 and not capture:
            print(result.stderr, file=sys.stderr)
            sys.exit(result.returncode)
        return result

    def git(self, *args: str, capture: bool = False, check: bool = True) -> subprocess.CompletedProcess:
        return self.run(["git", *args], capture=capture, check=check)

    def npm(self, *args: str, capture: bool = False, check: bool = True) -> subprocess.CompletedProcess:
        return self.run(["npm", *args], capture=capture, check=check, cwd=REPO_DIR)

    def npx(self, *args: str, capture: bool = False, check: bool = True) -> subprocess.CompletedProcess:
        return self.run(["npx", *args], capture=capture, check=check, cwd=REPO_DIR)

    def opencode(self, prompt: str) -> subprocess.CompletedProcess:
        print("  [opencode] invoking...")
        return self.run(["opencode", "run", prompt], capture=False, check=False, cwd=REPO_DIR)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ~/scripts && python3 -m pytest test_add_knowledge_sections.py -v`
Expected: PASS (15 tests)

- [ ] **Step 5: Commit**

```bash
cd ~/scripts
git add add_knowledge_sections.py test_add_knowledge_sections.py
git commit -m "feat: add Runner class with git/npm/npx/opencode wrappers"
```

---

### Task 5: `build_prompt` — the opencode instruction text

**Files:**

- Modify: `/home/alexeieleusis/scripts/add_knowledge_sections.py`
- Modify: `/home/alexeieleusis/scripts/test_add_knowledge_sections.py`

**Interfaces:**

- Produces: `build_prompt(rule_name: str, knowledge_path: str, error_context: str | None = None) -> str`.

- [ ] **Step 1: Write the failing tests**

Append to `/home/alexeieleusis/scripts/test_add_knowledge_sections.py`:

```python
from add_knowledge_sections import build_prompt, VIBE_TYPES_DIR


def test_build_prompt_names_the_file_and_knowledge_path():
    prompt = build_prompt("no-any-parameter", "catalog/T47-gradual-typing.md")
    assert "src/rules/no-any-parameter.ts" in prompt
    assert 'knowledgeUrl("catalog/T47-gradual-typing.md")' in prompt
    assert str(VIBE_TYPES_DIR / "catalog/T47-gradual-typing.md") in prompt
    assert "##" in prompt


def test_build_prompt_omits_error_context_by_default():
    prompt = build_prompt("no-any-parameter", "catalog/T47-gradual-typing.md")
    assert "previous attempt" not in prompt


def test_build_prompt_includes_error_context_when_given():
    prompt = build_prompt(
        "no-any-parameter", "catalog/T47-gradual-typing.md",
        error_context="TS2554: Expected 1 arguments, but got 2.",
    )
    assert "previous attempt" in prompt
    assert "TS2554: Expected 1 arguments, but got 2." in prompt
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ~/scripts && python3 -m pytest test_add_knowledge_sections.py -v`
Expected: FAIL with `ImportError: cannot import name 'build_prompt'`

- [ ] **Step 3: Write the implementation**

Add to `/home/alexeieleusis/scripts/add_knowledge_sections.py`, after the `Runner` class:

```python
def build_prompt(rule_name: str, knowledge_path: str, error_context: str | None = None) -> str:
    knowledge_file = VIBE_TYPES_DIR / knowledge_path
    lines = [
        "You are working in the eslint-lensflow-plugin project. Fix exactly one file: "
        f"src/rules/{rule_name}.ts.",
        "",
        f'That file already has a knowledgeUrl("{knowledge_path}") call (the constant it is '
        "assigned to may be named URL, RULE_URL, DOCS_URL, or similar — find it by the "
        "knowledgeUrl( call, don't assume the name). Read the full knowledge file at this "
        "absolute path:",
        "",
        f"  {knowledge_file}",
        "",
        f"and also read src/rules/{rule_name}.ts (its messages, description, and check logic) "
        "to understand why this rule exists.",
        "",
        "Then:",
        "1. Identify the single ## or ### heading in the knowledge file whose content most "
        "directly explains why this rule exists. Prefer a concrete Example, Pattern, or "
        "Antipattern subsection; a more general/conceptual heading is an acceptable fallback "
        "only if nothing more specific fits.",
        "2. Use that heading's exact text as written in the file, including any existing "
        'number/letter prefix (e.g. "Antipattern A — any to bypass type errors").',
        "3. If that exact heading text is not unique within the file (the same letter/title "
        'repeats under more than one parent heading), prefix it with its nearest ## ancestor '
        'heading, joined by " > " (e.g. "Antipatterns with Other Techniques > Antipattern B").',
        "4. Add that string as a second argument to the existing knowledgeUrl(...) call, so it "
        f'reads knowledgeUrl("{knowledge_path}", "<the section you found>").',
        "5. Do not change anything else in the file: no unrelated refactors, no touching other "
        "rules, no editing the knowledge file.",
    ]
    if error_context:
        lines += [
            "",
            "A previous attempt at this failed verification with this output:",
            "",
            error_context,
            "",
            "Fix the issue and try again.",
        ]
    return "\n".join(lines)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ~/scripts && python3 -m pytest test_add_knowledge_sections.py -v`
Expected: PASS (18 tests)

- [ ] **Step 5: Commit**

```bash
cd ~/scripts
git add add_knowledge_sections.py test_add_knowledge_sections.py
git commit -m "feat: add build_prompt for opencode instructions"
```

---

### Task 6: `verify_file` — pending-check + typecheck + targeted vitest run

**Files:**

- Modify: `/home/alexeieleusis/scripts/add_knowledge_sections.py`
- Modify: `/home/alexeieleusis/scripts/test_add_knowledge_sections.py`

**Interfaces:**

- Consumes: `is_pending` (Task 2), `Runner.npm`, `Runner.npx` (Task 4).
- Produces: `verify_file(runner: Runner, rule_name: str) -> tuple[bool, str]`.

- [ ] **Step 1: Write the failing tests**

Append to `/home/alexeieleusis/scripts/test_add_knowledge_sections.py`:

```python
from add_knowledge_sections import verify_file


def test_verify_file_fails_when_still_pending(tmp_path, monkeypatch):
    import add_knowledge_sections

    rules_dir = tmp_path / "src" / "rules"
    rules_dir.mkdir(parents=True)
    (rules_dir / "no-op-rule.ts").write_text(
        'const URL = knowledgeUrl("catalog/T47-gradual-typing.md");\n', encoding="utf-8",
    )
    monkeypatch.setattr(add_knowledge_sections, "REPO_DIR", tmp_path)

    ok, output = verify_file(Runner(dry_run=True), "no-op-rule")

    assert ok is False
    assert "knowledgeUrl" in output


def test_verify_file_dry_run_passes_once_section_present(tmp_path, monkeypatch, capsys):
    import add_knowledge_sections

    rules_dir = tmp_path / "src" / "rules"
    rules_dir.mkdir(parents=True)
    (rules_dir / "no-any-parameter.ts").write_text(
        'const URL = knowledgeUrl(\n'
        '  "catalog/T47-gradual-typing.md",\n'
        '  "Antipattern A — any to bypass type errors",\n'
        ');\n',
        encoding="utf-8",
    )
    monkeypatch.setattr(add_knowledge_sections, "REPO_DIR", tmp_path)

    ok, output = verify_file(Runner(dry_run=True), "no-any-parameter")

    assert ok is True
    assert output == ""
    captured = capsys.readouterr()
    assert "npm run typecheck" in captured.out
    assert "npx vitest run tests/rules/no-any-parameter.test.ts" in captured.out
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ~/scripts && python3 -m pytest test_add_knowledge_sections.py -v`
Expected: FAIL with `ImportError: cannot import name 'verify_file'`

- [ ] **Step 3: Write the implementation**

Add to `/home/alexeieleusis/scripts/add_knowledge_sections.py`, after `build_prompt`:

```python
def verify_file(runner: "Runner", rule_name: str) -> tuple[bool, str]:
    rule_file = REPO_DIR / "src" / "rules" / f"{rule_name}.ts"
    current_text = rule_file.read_text(encoding="utf-8")
    if is_pending(current_text):
        return False, (
            f"{rule_name}.ts still has a single-argument knowledgeUrl(...) call after this "
            "attempt — opencode likely made no edit, or removed the second argument."
        )

    typecheck = runner.npm("run", "typecheck", capture=True, check=False)
    if typecheck.returncode != 0:
        return False, typecheck.stdout + typecheck.stderr

    test = runner.npx(
        "vitest", "run", f"tests/rules/{rule_name}.test.ts",
        capture=True, check=False,
    )
    if test.returncode != 0:
        return False, test.stdout + test.stderr

    return True, ""
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ~/scripts && python3 -m pytest test_add_knowledge_sections.py -v`
Expected: PASS (20 tests)

- [ ] **Step 5: Commit**

```bash
cd ~/scripts
git add add_knowledge_sections.py test_add_knowledge_sections.py
git commit -m "feat: add verify_file for pending-check, typecheck, and targeted vitest run"
```

---

### Task 7: `apply_one` — per-file opencode/verify/retry/commit state machine

**Files:**

- Modify: `/home/alexeieleusis/scripts/add_knowledge_sections.py`
- Modify: `/home/alexeieleusis/scripts/test_add_knowledge_sections.py`

**Interfaces:**

- Consumes: `Runner` (Task 4), `build_prompt` (Task 5), `verify_file` (Task 6).
- Produces: `apply_one(runner: Runner, entry: dict, max_retries: int, verify_fn: Callable[[Runner, str], tuple[bool, str]] = verify_file) -> tuple[bool, str]` (returns `(succeeded, last_error)`).

- [ ] **Step 1: Write the failing tests**

Append to `/home/alexeieleusis/scripts/test_add_knowledge_sections.py`:

```python
from add_knowledge_sections import apply_one

ENTRY = {"rule": "no-any-parameter", "knowledge_path": "catalog/T47-gradual-typing.md"}


def test_apply_one_succeeds_first_try(capsys):
    def always_pass(_runner, _rule_name):
        return True, ""

    ok, error = apply_one(Runner(dry_run=True), ENTRY, max_retries=3, verify_fn=always_pass)

    assert ok is True
    assert error == ""
    captured = capsys.readouterr()
    assert "git add eslint-lensflow-plugin/src/rules/no-any-parameter.ts" in captured.out
    assert "git commit -m fix: add knowledge section to no-any-parameter" in captured.out
    assert "retry" not in captured.out
    assert "git restore" not in captured.out


def test_apply_one_retries_then_succeeds(capsys):
    calls = {"n": 0}

    def fail_twice_then_pass(_runner, _rule_name):
        calls["n"] += 1
        if calls["n"] < 3:
            return False, f"error attempt {calls['n']}"
        return True, ""

    ok, error = apply_one(Runner(dry_run=True), ENTRY, max_retries=3, verify_fn=fail_twice_then_pass)

    assert ok is True
    assert error == ""
    assert calls["n"] == 3
    captured = capsys.readouterr()
    assert captured.out.count("[retry") == 2


def test_apply_one_gives_up_after_max_retries(capsys):
    def always_fail(_runner, _rule_name):
        return False, "still broken"

    ok, error = apply_one(Runner(dry_run=True), ENTRY, max_retries=2, verify_fn=always_fail)

    assert ok is False
    assert error == "still broken"
    captured = capsys.readouterr()
    assert captured.out.count("[retry") == 2
    assert "git restore eslint-lensflow-plugin/src/rules/no-any-parameter.ts" in captured.out
    assert "git commit" not in captured.out
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ~/scripts && python3 -m pytest test_add_knowledge_sections.py -v`
Expected: FAIL with `ImportError: cannot import name 'apply_one'`

- [ ] **Step 3: Write the implementation**

Add to `/home/alexeieleusis/scripts/add_knowledge_sections.py`, after `verify_file`:

```python
def apply_one(
    runner: "Runner",
    entry: dict,
    max_retries: int,
    verify_fn: Callable[["Runner", str], tuple[bool, str]] = verify_file,
) -> tuple[bool, str]:
    rule_name = entry["rule"]
    knowledge_path = entry["knowledge_path"]
    rule_path = f"eslint-lensflow-plugin/src/rules/{rule_name}.ts"

    error_context: str | None = None
    for attempt in range(1, max_retries + 1):
        prompt = build_prompt(rule_name, knowledge_path, error_context)
        runner.opencode(prompt)

        ok, output = verify_fn(runner, rule_name)
        if ok:
            runner.git("add", rule_path)
            runner.git("commit", "-m", f"fix: add knowledge section to {rule_name}", check=False)
            return True, ""

        error_context = output
        print(f"  [retry {attempt}/{max_retries}] {rule_name} failed verification")

    runner.git("restore", rule_path, check=False)
    return False, error_context or ""
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ~/scripts && python3 -m pytest test_add_knowledge_sections.py -v`
Expected: PASS (23 tests)

- [ ] **Step 5: Commit**

```bash
cd ~/scripts
git add add_knowledge_sections.py test_add_knowledge_sections.py
git commit -m "feat: add apply_one retry/verify/commit state machine"
```

---

### Task 8: `filter_entries`, `apply_map`, and full `--apply` CLI

**Files:**

- Modify: `/home/alexeieleusis/scripts/add_knowledge_sections.py`
- Modify: `/home/alexeieleusis/scripts/test_add_knowledge_sections.py`

**Interfaces:**

- Consumes: `apply_one` (Task 7), `Runner` (Task 4).
- Produces: `filter_entries(entries: list[dict], start: str | None, end: str | None) -> list[dict]`, `apply_map(runner: Runner, entries: list[dict], max_retries: int, manual_review_path: Path) -> tuple[int, int]`, updated `main()` with `--apply`, `--start`, `--end`, `--max-retries`, `--manual-review-path`.

- [ ] **Step 1: Write the failing tests**

Append to `/home/alexeieleusis/scripts/test_add_knowledge_sections.py`:

```python
from add_knowledge_sections import filter_entries, apply_map


# ── filter_entries ─────────────────────────────────────────────────────────────

ENTRIES = [
    {"rule": "no-any-boundary", "knowledge_path": "x"},
    {"rule": "no-any-cast-chain", "knowledge_path": "x"},
    {"rule": "no-any-parameter", "knowledge_path": "x"},
    {"rule": "prefer-record-over-index-signature", "knowledge_path": "x"},
]


def test_filter_entries_no_filter():
    assert filter_entries(ENTRIES, None, None) == ENTRIES


def test_filter_entries_start_only():
    result = filter_entries(ENTRIES, "no-any-parameter", None)
    assert [e["rule"] for e in result] == ["no-any-parameter", "prefer-record-over-index-signature"]


def test_filter_entries_end_only():
    result = filter_entries(ENTRIES, None, "no-any-cast-chain")
    assert [e["rule"] for e in result] == ["no-any-boundary", "no-any-cast-chain"]


def test_filter_entries_start_not_in_list():
    assert filter_entries(ENTRIES, "zzz-nonexistent", None) == []


# ── apply_map ────────────────────────────────────────────────────────────────────

def test_apply_map_counts_success_and_failure_and_writes_manual_review(tmp_path, monkeypatch):
    import add_knowledge_sections

    def fake_apply_one(_runner, entry, _max_retries, verify_fn=None):
        if entry["rule"] == "good-rule":
            return True, ""
        return False, "boom"

    monkeypatch.setattr(add_knowledge_sections, "apply_one", fake_apply_one)

    entries = [
        {"rule": "good-rule", "knowledge_path": "x"},
        {"rule": "bad-rule", "knowledge_path": "x"},
    ]
    manual_review_path = tmp_path / "needs-section-review.txt"

    succeeded, failed = apply_map(Runner(dry_run=True), entries, 3, manual_review_path)

    assert (succeeded, failed) == (1, 1)
    assert "bad-rule" in manual_review_path.read_text(encoding="utf-8")
    assert "boom" in manual_review_path.read_text(encoding="utf-8")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ~/scripts && python3 -m pytest test_add_knowledge_sections.py -v`
Expected: FAIL with `ImportError: cannot import name 'filter_entries'`

- [ ] **Step 3: Write the implementation**

Add to `/home/alexeieleusis/scripts/add_knowledge_sections.py`, after `apply_one`:

```python
def filter_entries(entries: list[dict], start: str | None, end: str | None) -> list[dict]:
    result: list[dict] = []
    past_start = start is None
    for entry in entries:
        name = entry["rule"]
        if not past_start:
            if name >= start:
                past_start = True
            else:
                continue
        result.append(entry)
        if end is not None and name >= end:
            break
    return result


def apply_map(
    runner: "Runner",
    entries: list[dict],
    max_retries: int,
    manual_review_path: Path,
) -> tuple[int, int]:
    succeeded = 0
    failed = 0
    failures: list[str] = []
    total = len(entries)

    for idx, entry in enumerate(entries):
        print(f"[{idx + 1}/{total}] {entry['rule']}")
        ok, error = apply_one(runner, entry, max_retries)
        if ok:
            succeeded += 1
        else:
            failed += 1
            failures.append(f"{entry['rule']}: {error.strip()[:500]}")

    if failures:
        manual_review_path.write_text("\n\n".join(failures) + "\n", encoding="utf-8")

    return succeeded, failed
```

Replace the `main()` function with the full CLI:

```python
def main() -> None:
    p = argparse.ArgumentParser(
        description="Add knowledge-section annotations to knowledgeUrl() calls "
        "across eslint-lensflow-plugin/src/rules/*.ts"
    )
    p.add_argument("--build-map", action="store_true",
                    help="Scan src/rules/, write the map JSON, and exit")
    p.add_argument("--apply", action="store_true",
                    help="Apply fixes from the map file via opencode")
    p.add_argument("--map-path", default="knowledge-sections-map.json", metavar="PATH",
                    help="Path to the map JSON file (default: knowledge-sections-map.json)")
    p.add_argument("--manual-review-path", default="needs-section-review.txt", metavar="PATH",
                    help="Where to log files that failed after all retries")
    p.add_argument("--max-retries", type=int, default=3, metavar="N",
                    help="Retry attempts per file before giving up (default: 3)")
    p.add_argument("--start", metavar="NAME",
                    help="Skip entries alphabetically before this rule name")
    p.add_argument("--end", metavar="NAME",
                    help="Stop after this rule name (inclusive)")
    p.add_argument("--dry-run", action="store_true",
                    help="Print actions without executing them")
    p.add_argument("--verbose", action="store_true",
                    help="Show every git/npm/opencode command as it runs")
    args = p.parse_args()

    runner = Runner(dry_run=args.dry_run, verbose=args.verbose)
    map_path = Path(args.map_path)

    if args.build_map:
        entries = build_map(REPO_DIR, VIBE_TYPES_DIR, map_path)
        print(f"Wrote {len(entries)} entries to {map_path}")
        return

    if args.apply:
        status = runner.git("status", "--porcelain", capture=True, check=False)
        if status.stdout.strip() and not args.dry_run:
            print(
                "Working tree is not clean. Commit or stash changes before running --apply.",
                file=sys.stderr,
            )
            sys.exit(1)

        baseline = runner.npm("run", "typecheck", capture=True, check=False)
        if baseline.returncode != 0 and not args.dry_run:
            print(
                "Baseline `npm run typecheck` is already failing before any fixes are "
                "applied. Fix the baseline first — otherwise every file will fail "
                "verification and burn retries for nothing.\n\n"
                + baseline.stdout + baseline.stderr,
                file=sys.stderr,
            )
            sys.exit(1)

        entries = json.loads(map_path.read_text(encoding="utf-8"))
        entries = filter_entries(entries, args.start, args.end)

        succeeded, failed = apply_map(
            runner, entries, args.max_retries, Path(args.manual_review_path),
        )
        print(f"\nDone. {succeeded} fixed, {failed} failed.")
        if failed:
            print(f"See {args.manual_review_path} for details.")
        return

    p.print_help()


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ~/scripts && python3 -m pytest test_add_knowledge_sections.py -v`
Expected: PASS (28 tests)

- [ ] **Step 5: Commit**

```bash
cd ~/scripts
git add add_knowledge_sections.py test_add_knowledge_sections.py
git commit -m "feat: add filter_entries, apply_map, and full --apply CLI"
```

---

### Task 9: Manual smoke test against the real repo

**Files:**

- None created/modified — this task exercises the finished script against the real `eslint-lensflow-plugin` repo, read-only (`--build-map` and `--apply --dry-run` make no real changes).

**Interfaces:**

- Consumes: the complete `add_knowledge_sections.py` CLI (Tasks 1–8).

- [ ] **Step 1: Confirm the working tree is clean**

Run: `cd /home/alexeieleusis/second_ssd/development/lensflow/eslint-lensflow-plugin && git status --short`
Expected: no output (clean tree). If not clean, stop and resolve before continuing.

- [ ] **Step 2: Build the real map**

```bash
cd ~/scripts
python3 add_knowledge_sections.py --build-map \
  --map-path /tmp/claude-1000/-home-alexeieleusis-second-ssd-development-lensflow-eslint-lensflow-plugin/7ffc9fe5-604b-4d6e-bf37-83c17b0452fe/scratchpad/knowledge-sections-map.json
```

Expected: `Wrote 282 entries to /tmp/.../knowledge-sections-map.json` — no `[warn]` lines. (282 because none of the 282 rule files have a section yet at this point in the project.)

- [ ] **Step 3: Sanity-check the map**

```bash
python3 -c "
import json
entries = json.load(open('/tmp/claude-1000/-home-alexeieleusis-second-ssd-development-lensflow-eslint-lensflow-plugin/7ffc9fe5-604b-4d6e-bf37-83c17b0452fe/scratchpad/knowledge-sections-map.json'))
print(len(entries))
print(entries[0])
"
```

Expected: `282` and a first entry shaped like `{'rule': 'consistent-constructor-strategy', 'knowledge_path': 'catalog/T26-refinement-types.md'}` (or whichever rule sorts first alphabetically).

- [ ] **Step 4: Dry-run `--apply` on a small known slice to inspect the generated prompt**

```bash
cd /home/alexeieleusis/second_ssd/development/lensflow/eslint-lensflow-plugin
python3 ~/scripts/add_knowledge_sections.py --apply --dry-run --verbose \
  --map-path /tmp/claude-1000/-home-alexeieleusis-second-ssd-development-lensflow-eslint-lensflow-plugin/7ffc9fe5-604b-4d6e-bf37-83c17b0452fe/scratchpad/knowledge-sections-map.json \
  --start no-any-parameter --end no-any-parameter
```

Expected: prints `git status --porcelain`, then `npm run typecheck` (baseline), then a `[1/1] no-any-parameter` header, an `opencode run ...` line whose prompt mentions `src/rules/no-any-parameter.ts`, the absolute path to `catalog/T47-gradual-typing.md` under `VIBE_TYPES_DIR`, and the five numbered instructions, followed by `npm run typecheck`, `npx vitest run tests/rules/no-any-parameter.test.ts`, and `git add`/`git commit` lines (dry-run, so nothing is actually written or committed), then a final `Done. 1 fixed, 0 failed.` line.

- [ ] **Step 5: Confirm no real changes were made**

Run: `cd /home/alexeieleusis/second_ssd/development/lensflow/eslint-lensflow-plugin && git status --short`
Expected: no output (dry-run made no real changes).

- [ ] **Step 6: Report readiness**

No commit for this task (it's read-only verification). Report back: the map's real count matches expectations (282, no warnings) and the dry-run prompt looks correct — the script is ready for a real `--apply` run, which the user should trigger explicitly, given it will spend ~282 opencode invocations and create up to 282 commits.

Also flag as a follow-up for the user to schedule separately: **once a full `--apply` run has actually finished migrating all 282 rules**, `section` on `knowledgeUrl()` in `src/utils/knowledge-url.ts` can be tightened from optional (`section?: string`) to required (`section: string`), followed by a full `npm run typecheck` + `npm test` to confirm every call site now supplies it. That tightening is deliberately left out of this plan because it depends on a long-running, cost-incurring `--apply` run this plan does not itself execute.
