# Restore Help URLs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `~/scripts/restore_help_urls.py`, a script that normalizes help-URL usage across all 282 files in `eslint-lensflow-plugin/src/rules/` to the `knowledgeUrl()` pattern used in `consistent-constructor-strategy.ts`, driving the actual per-file code edits through `opencode run`.

**Architecture:** Two-phase CLI script (`--build-map` then `--apply`), following the `Runner`-class + `argparse` conventions already established in `~/scripts/rewrite_rule_branches.py` and `~/scripts/fix_stack.py`. Phase 1 is pure classification logic writing a JSON map to disk; Phase 2 replays that map through opencode with a bounded per-file retry-and-verify loop, committing one fix per file.

**Tech Stack:** Python 3 (stdlib only: `argparse`, `json`, `re`, `subprocess`, `dataclasses`, `pathlib`), `pytest` for tests, `opencode` CLI (already installed at `~/.opencode/bin/opencode`), the repo's own `npm run typecheck` / `npx vitest` for verification.

## Global Constraints

- Script and its test file live in `~/scripts/`: `restore_help_urls.py` and `test_restore_help_urls.py`, matching the location and style of the existing sibling scripts there.
- `REPO_DIR = Path("/home/alexeieleusis/second_ssd/development/lensflow/eslint-lensflow-plugin")`, `GIT_ROOT = REPO_DIR.parent` — git commands run with `cwd=GIT_ROOT` (so `git show branch:eslint-lensflow-plugin/...` and `git add`/`git restore` paths resolve correctly, matching `rewrite_rule_branches.py`'s documented reasoning); `npm`/`npx`/`opencode` commands run with `cwd=REPO_DIR`.
- Every non-compliant rule file has exactly one associated knowledge markdown path (verified during design — no rule needs splitting across multiple `.md` sources).
- Commit message for each per-file fix: `fix: restore help URL in <rule-name>`. Commit message for the shared-util cleanup: `fix: remove unused <CONST_NAME> constant`.
- Retry budget per file: 3 attempts (configurable via `--max-retries`) before reverting that file and logging it, never aborting the whole run.
- No test-file mocking libraries beyond what's already used in `test_rewrite_rule_branches.py` (plain `pytest`, `capsys`, dependency-injected callables/dry-run) — keep the same lightweight testing style already established in this scripts directory.

---

### Task 1: Pure URL/path extraction and compliance-check functions

**Files:**
- Create: `/home/alexeieleusis/scripts/restore_help_urls.py`
- Create: `/home/alexeieleusis/scripts/test_restore_help_urls.py`

**Interfaces:**
- Produces: `extract_knowledge_path_from_raw_url(text: str) -> str | None`, `extract_knowledge_path_from_call(text: str) -> str | None`, `find_shared_url_import(text: str) -> tuple[str, str] | None` (returns `(const_name, relative_import_path)`), `is_compliant(text: str) -> bool`.

- [ ] **Step 1: Write the failing tests**

Create `/home/alexeieleusis/scripts/test_restore_help_urls.py`:

```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from restore_help_urls import (
    extract_knowledge_path_from_raw_url,
    extract_knowledge_path_from_call,
    find_shared_url_import,
    is_compliant,
)


# ── extract_knowledge_path_from_raw_url ───────────────────────────────────────

def test_extract_raw_url_pinned_commit():
    text = (
        '        "Use `@ts-expect-error` instead. See: '
        'https://raw.githubusercontent.com/jpablo/vibe-types/'
        '7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/'
        'catalog/T47-gradual-typing.md",'
    )
    assert extract_knowledge_path_from_raw_url(text) == "catalog/T47-gradual-typing.md"


def test_extract_raw_url_refs_heads_main():
    text = (
        'See: https://raw.githubusercontent.com/jpablo/vibe-types/'
        'refs/heads/main/plugin/skills/typescript/usecases/UC05-structural-contracts.md",'
    )
    assert extract_knowledge_path_from_raw_url(text) == "usecases/UC05-structural-contracts.md"


def test_extract_raw_url_absent():
    assert extract_knowledge_path_from_raw_url("no url here") is None


# ── extract_knowledge_path_from_call ──────────────────────────────────────────

def test_extract_call_finds_path():
    text = 'const URL = knowledgeUrl("catalog/T26-refinement-types.md");'
    assert extract_knowledge_path_from_call(text) == "catalog/T26-refinement-types.md"


def test_extract_call_absent():
    assert extract_knowledge_path_from_call("const x = 1;") is None


# ── find_shared_url_import ────────────────────────────────────────────────────

def test_find_shared_url_import_finds_named_const():
    text = (
        'import {\n'
        '  ASYNC_ITERATION_URL,\n'
        '  hasAsyncIteratorSignature,\n'
        '} from "../utils/async-iteration.js";\n'
    )
    assert find_shared_url_import(text) == ("ASYNC_ITERATION_URL", "../utils/async-iteration.js")


def test_find_shared_url_import_ignores_knowledge_url_helper():
    text = 'import { knowledgeUrl } from "../utils/knowledge-url.js";'
    assert find_shared_url_import(text) is None


def test_find_shared_url_import_absent():
    assert find_shared_url_import('import ts from "typescript";') is None


# ── is_compliant ───────────────────────────────────────────────────────────────

def test_is_compliant_true_for_standard_pattern():
    text = (
        'const URL = knowledgeUrl("catalog/T26-refinement-types.md");\n'
        'messages: { inconsistent: "Bad thing. See: {{url}}" },\n'
        'context.report({ node, messageId: "inconsistent", data: { url: URL } });\n'
    )
    assert is_compliant(text) is True


def test_is_compliant_false_missing_knowledge_url_call():
    text = 'messages: { bad: "Bad thing. See: {{url}}" }, data: { url: "x" }'
    assert is_compliant(text) is False


def test_is_compliant_false_missing_url_placeholder():
    text = (
        'const URL = knowledgeUrl("catalog/T59-existential-types.md");\n'
        'messages: { bad: "Bad thing. See: " + URL },\n'
    )
    assert is_compliant(text) is False


def test_is_compliant_false_missing_data_url():
    text = (
        'const URL = knowledgeUrl("catalog/T26-refinement-types.md");\n'
        'messages: { bad: "Bad thing. See: {{url}}" },\n'
        'context.report({ node, messageId: "bad", data: { name: x } });\n'
    )
    assert is_compliant(text) is False
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ~/scripts && python3 -m pytest test_restore_help_urls.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'restore_help_urls'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `/home/alexeieleusis/scripts/restore_help_urls.py`:

```python
#!/usr/bin/env python3
"""
restore_help_urls.py — normalize help-URL usage across every rule in
eslint-lensflow-plugin/src/rules/ to the knowledgeUrl() pattern used in
consistent-constructor-strategy.ts, driving the actual code edits through
`opencode run`.

Usage:
  ./restore_help_urls.py --build-map [--map-path PATH]
  ./restore_help_urls.py --apply [--map-path PATH] [--start NAME] [--end NAME]
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

GITHUB_URL_RE = re.compile(
    r'raw\.githubusercontent\.com/jpablo/vibe-types/[^"]+?/plugin/skills/typescript/'
    r"([A-Za-z0-9/_.-]+\.md)"
)
KNOWLEDGE_URL_CALL_RE = re.compile(r'knowledgeUrl\(\s*"([^"]+)"\s*\)')
IMPORT_BLOCK_RE = re.compile(r'import\s*\{([^}]*)\}\s*from\s*"(\.\./utils/[^"]+)"')


def extract_knowledge_path_from_raw_url(text: str) -> str | None:
    m = GITHUB_URL_RE.search(text)
    return m.group(1) if m else None


def extract_knowledge_path_from_call(text: str) -> str | None:
    m = KNOWLEDGE_URL_CALL_RE.search(text)
    return m.group(1) if m else None


def find_shared_url_import(text: str) -> tuple[str, str] | None:
    for names_blob, import_path in IMPORT_BLOCK_RE.findall(text):
        if import_path == "../utils/knowledge-url.js":
            continue
        for name in (n.strip() for n in names_blob.split(",")):
            if name.endswith("_URL"):
                return name, import_path
    return None


def is_compliant(text: str) -> bool:
    if "knowledgeUrl(" not in text:
        return False
    if "{{url}}" not in text:
        return False
    if not re.search(r"url:\s*\w", text):
        return False
    return True


if __name__ == "__main__":
    pass
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ~/scripts && python3 -m pytest test_restore_help_urls.py -v`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
cd ~/scripts
git add restore_help_urls.py test_restore_help_urls.py
git commit -m "feat: add URL extraction and compliance-check helpers to restore_help_urls"
```

---

### Task 2: `classify_file` — combine extraction into a per-rule classification

**Files:**
- Modify: `/home/alexeieleusis/scripts/restore_help_urls.py`
- Modify: `/home/alexeieleusis/scripts/test_restore_help_urls.py`

**Interfaces:**
- Consumes: `extract_knowledge_path_from_raw_url`, `extract_knowledge_path_from_call`, `find_shared_url_import`, `is_compliant` (Task 1).
- Produces: `ClassifyResult` dataclass with fields `knowledge_path: str | None`, `source: str`, `cleanup_util: str | None = None`; `classify_file(rule_name: str, current_text: str, read_util_text: Callable[[str], str | None], read_history_text: Callable[[], str | None]) -> ClassifyResult | None` (returns `None` when the file is already compliant — meaning "skip").

- [ ] **Step 1: Write the failing tests**

Append to `/home/alexeieleusis/scripts/test_restore_help_urls.py`:

```python
from restore_help_urls import ClassifyResult, classify_file


COMPLIANT_TEXT = (
    'const URL = knowledgeUrl("catalog/T26-refinement-types.md");\n'
    'messages: { inconsistent: "Bad thing. See: {{url}}" },\n'
    'context.report({ node, messageId: "inconsistent", data: { url: URL } });\n'
)

RAW_URL_TEXT = (
    'const URL =\n'
    '  "https://raw.githubusercontent.com/jpablo/vibe-types/'
    '66eaf514cd2bd8bf79b2c3c64d9d43786b3dc174/plugin/skills/typescript/'
    'usecases/UC04-generic-constraints.md";\n'
)

CONCAT_STYLE_TEXT = (
    'const URL = knowledgeUrl("catalog/T59-existential-types.md");\n'
    'messages: { bad: "Bad thing. See: " + URL },\n'
)

SHARED_UTIL_RULE_TEXT = (
    'import {\n  ASYNC_ITERATION_URL,\n  hasAsyncIteratorSignature,\n'
    '} from "../utils/async-iteration.js";\n'
)

SHARED_UTIL_FILE_TEXT = (
    'export const ASYNC_ITERATION_URL =\n'
    '  "https://raw.githubusercontent.com/jpablo/vibe-types/'
    'ebff3754e7ddc862d05c3cd1a19480bdf52dfc25/plugin/skills/typescript/'
    'catalog/T64-async-iteration.md";\n'
)

MISSING_TEXT = 'export default createRule({ name: "no-x" });\n'

HISTORY_TEXT = (
    'messages: { bad: "Bad thing. See: '
    'https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/'
    'plugin/skills/typescript/catalog/T57-typestate.md" }\n'
)


def _no_util(_import_path: str) -> str | None:
    return None


def _no_history() -> str | None:
    return None


def test_classify_file_compliant_returns_none():
    assert classify_file("r", COMPLIANT_TEXT, _no_util, _no_history) is None


def test_classify_file_raw_url():
    result = classify_file("no-any-array-parameter", RAW_URL_TEXT, _no_util, _no_history)
    assert result == ClassifyResult(
        knowledge_path="usecases/UC04-generic-constraints.md",
        source="raw-url",
    )


def test_classify_file_concat_style():
    result = classify_file("no-cast-to-concrete-impl-t59", CONCAT_STYLE_TEXT, _no_util, _no_history)
    assert result == ClassifyResult(
        knowledge_path="catalog/T59-existential-types.md",
        source="concat-style",
    )


def test_classify_file_shared_util_const():
    def read_util(import_path: str) -> str | None:
        assert import_path == "../utils/async-iteration.js"
        return SHARED_UTIL_FILE_TEXT

    result = classify_file("no-collect-then-sync-iterate", SHARED_UTIL_RULE_TEXT, read_util, _no_history)
    assert result == ClassifyResult(
        knowledge_path="catalog/T64-async-iteration.md",
        source="shared-util-const",
        cleanup_util="../utils/async-iteration.js",
    )


def test_classify_file_missing_recovered_from_history():
    def read_history() -> str | None:
        return HISTORY_TEXT

    result = classify_file("require-typestate-rebinding", MISSING_TEXT, _no_util, read_history)
    assert result == ClassifyResult(
        knowledge_path="catalog/T57-typestate.md",
        source="missing-recovered",
    )


def test_classify_file_unresolved_when_nothing_found():
    result = classify_file("mystery-rule", MISSING_TEXT, _no_util, _no_history)
    assert result == ClassifyResult(knowledge_path=None, source="unresolved")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ~/scripts && python3 -m pytest test_restore_help_urls.py -v`
Expected: FAIL with `ImportError: cannot import name 'ClassifyResult'`

- [ ] **Step 3: Write the implementation**

Add to `/home/alexeieleusis/scripts/restore_help_urls.py`, after `is_compliant`:

```python
from dataclasses import dataclass


@dataclass
class ClassifyResult:
    knowledge_path: str | None
    source: str
    cleanup_util: str | None = None


def classify_file(
    rule_name: str,
    current_text: str,
    read_util_text: Callable[[str], str | None],
    read_history_text: Callable[[], str | None],
) -> ClassifyResult | None:
    if is_compliant(current_text):
        return None

    call_path = extract_knowledge_path_from_call(current_text)
    if call_path:
        return ClassifyResult(knowledge_path=call_path, source="concat-style")

    raw_path = extract_knowledge_path_from_raw_url(current_text)
    if raw_path:
        return ClassifyResult(knowledge_path=raw_path, source="raw-url")

    shared = find_shared_url_import(current_text)
    if shared:
        _const_name, import_path = shared
        util_text = read_util_text(import_path)
        if util_text:
            util_path = (
                extract_knowledge_path_from_raw_url(util_text)
                or extract_knowledge_path_from_call(util_text)
            )
            if util_path:
                return ClassifyResult(
                    knowledge_path=util_path,
                    source="shared-util-const",
                    cleanup_util=import_path,
                )

    history_text = read_history_text()
    if history_text:
        hist_path = (
            extract_knowledge_path_from_raw_url(history_text)
            or extract_knowledge_path_from_call(history_text)
        )
        if hist_path:
            return ClassifyResult(knowledge_path=hist_path, source="missing-recovered")

    return ClassifyResult(knowledge_path=None, source="unresolved")
```

Also update the `if __name__ == "__main__":` block's imports are unaffected; no other change needed yet.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ~/scripts && python3 -m pytest test_restore_help_urls.py -v`
Expected: PASS (17 tests)

- [ ] **Step 5: Commit**

```bash
cd ~/scripts
git add restore_help_urls.py test_restore_help_urls.py
git commit -m "feat: add classify_file to resolve each rule's target knowledge path"
```

---

### Task 3: `Runner` class with git/gh/npm/npx/opencode wrappers

**Files:**
- Modify: `/home/alexeieleusis/scripts/restore_help_urls.py`
- Modify: `/home/alexeieleusis/scripts/test_restore_help_urls.py`

**Interfaces:**
- Produces: `Runner(dry_run: bool = False, verbose: bool = False)` with methods `run(cmd, capture=False, check=True, cwd=None)`, `git(*args, capture=False, check=True)`, `gh(*args, capture=False, check=True)`, `npm(*args, capture=False, check=True)`, `npx(*args, capture=False, check=True)`, `opencode(prompt: str)`.

- [ ] **Step 1: Write the failing tests**

Append to `/home/alexeieleusis/scripts/test_restore_help_urls.py`:

```python
from restore_help_urls import Runner


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


def test_runner_gh_prepends_gh(capsys):
    r = Runner(dry_run=True)
    r.gh("pr", "list")
    captured = capsys.readouterr()
    assert "gh pr list" in captured.out


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

Run: `cd ~/scripts && python3 -m pytest test_restore_help_urls.py -v`
Expected: FAIL with `ImportError: cannot import name 'Runner'`

- [ ] **Step 3: Write the implementation**

Add to `/home/alexeieleusis/scripts/restore_help_urls.py`, after the `ClassifyResult`/`classify_file` block:

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

    def gh(self, *args: str, capture: bool = False, check: bool = True) -> subprocess.CompletedProcess:
        return self.run(["gh", *args], capture=capture, check=check)

    def npm(self, *args: str, capture: bool = False, check: bool = True) -> subprocess.CompletedProcess:
        return self.run(["npm", *args], capture=capture, check=check, cwd=REPO_DIR)

    def npx(self, *args: str, capture: bool = False, check: bool = True) -> subprocess.CompletedProcess:
        return self.run(["npx", *args], capture=capture, check=check, cwd=REPO_DIR)

    def opencode(self, prompt: str) -> subprocess.CompletedProcess:
        print("  [opencode] invoking...")
        return self.run(["opencode", "run", prompt], capture=False, check=False, cwd=REPO_DIR)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ~/scripts && python3 -m pytest test_restore_help_urls.py -v`
Expected: PASS (23 tests)

- [ ] **Step 5: Commit**

```bash
cd ~/scripts
git add restore_help_urls.py test_restore_help_urls.py
git commit -m "feat: add Runner class with git/gh/npm/npx/opencode wrappers"
```

---

### Task 4: `build_map` orchestration + `--build-map` CLI

**Files:**
- Modify: `/home/alexeieleusis/scripts/restore_help_urls.py`
- Modify: `/home/alexeieleusis/scripts/test_restore_help_urls.py`

**Interfaces:**
- Consumes: `classify_file`, `Runner` (Tasks 2–3).
- Produces: `build_map(runner: Runner, repo_dir: Path, out_path: Path) -> list[dict]`. Each dict: `{"rule": str, "knowledge_path": str, "source": str, "cleanup_util": str | None}`.

- [ ] **Step 1: Write the failing tests**

Append to `/home/alexeieleusis/scripts/test_restore_help_urls.py`:

```python
import json
from restore_help_urls import build_map


def test_build_map_writes_expected_entries(tmp_path):
    rules_dir = tmp_path / "src" / "rules"
    rules_dir.mkdir(parents=True)

    (rules_dir / "already-ok.ts").write_text(COMPLIANT_TEXT, encoding="utf-8")
    (rules_dir / "needs-fix.ts").write_text(RAW_URL_TEXT, encoding="utf-8")

    class FakeRunner:
        dry_run = False

        def git(self, *args, capture=False, check=True):
            class R:
                returncode = 1
                stdout = ""
            return R()

    out_path = tmp_path / "url-map.json"
    entries = build_map(FakeRunner(), tmp_path, out_path)

    assert entries == [
        {
            "rule": "needs-fix",
            "knowledge_path": "usecases/UC04-generic-constraints.md",
            "source": "raw-url",
            "cleanup_util": None,
        }
    ]
    assert json.loads(out_path.read_text(encoding="utf-8")) == entries


def test_build_map_resolves_shared_util_from_disk(tmp_path):
    rules_dir = tmp_path / "src" / "rules"
    utils_dir = tmp_path / "src" / "utils"
    rules_dir.mkdir(parents=True)
    utils_dir.mkdir(parents=True)

    (rules_dir / "no-collect-then-sync-iterate.ts").write_text(SHARED_UTIL_RULE_TEXT, encoding="utf-8")
    (utils_dir / "async-iteration.ts").write_text(SHARED_UTIL_FILE_TEXT, encoding="utf-8")

    class FakeRunner:
        dry_run = False

        def git(self, *args, capture=False, check=True):
            class R:
                returncode = 1
                stdout = ""
            return R()

    out_path = tmp_path / "url-map.json"
    entries = build_map(FakeRunner(), tmp_path, out_path)

    assert entries == [
        {
            "rule": "no-collect-then-sync-iterate",
            "knowledge_path": "catalog/T64-async-iteration.md",
            "source": "shared-util-const",
            "cleanup_util": "../utils/async-iteration.js",
        }
    ]
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ~/scripts && python3 -m pytest test_restore_help_urls.py -v`
Expected: FAIL with `ImportError: cannot import name 'build_map'`

- [ ] **Step 3: Write the implementation**

Add to `/home/alexeieleusis/scripts/restore_help_urls.py`, after the `Runner` class:

```python
def build_map(runner: "Runner", repo_dir: Path, out_path: Path) -> list[dict]:
    rules_dir = repo_dir / "src" / "rules"
    entries: list[dict] = []

    for rule_file in sorted(rules_dir.glob("*.ts")):
        rule_name = rule_file.stem
        current_text = rule_file.read_text(encoding="utf-8")

        def read_util_text(import_path: str, _rules_dir: Path = rules_dir) -> str | None:
            util_file = (_rules_dir / import_path).resolve().with_suffix(".ts")
            return util_file.read_text(encoding="utf-8") if util_file.exists() else None

        def read_history_text(_rule_name: str = rule_name) -> str | None:
            git_path = f"eslint-lensflow-plugin/src/rules/{_rule_name}.ts"
            result = runner.git("show", f"delete_lastRule:{git_path}", capture=True, check=False)
            return result.stdout if result.returncode == 0 else None

        result = classify_file(rule_name, current_text, read_util_text, read_history_text)
        if result is None:
            continue
        if result.knowledge_path is None:
            print(f"  [warn] could not resolve knowledge path for {rule_name}", file=sys.stderr)
            continue

        entries.append({
            "rule": rule_name,
            "knowledge_path": result.knowledge_path,
            "source": result.source,
            "cleanup_util": result.cleanup_util,
        })

    out_path.write_text(json.dumps(entries, indent=2) + "\n", encoding="utf-8")
    return entries
```

Add the `--build-map` CLI at the bottom of the file, replacing the placeholder `if __name__ == "__main__": pass` block:

```python
def main() -> None:
    p = argparse.ArgumentParser(
        description="Restore help URLs across eslint-lensflow-plugin/src/rules/*.ts"
    )
    p.add_argument("--build-map", action="store_true",
                    help="Scan src/rules/, write url-map.json, and exit")
    p.add_argument("--map-path", default="url-map.json", metavar="PATH",
                    help="Path to the map JSON file (default: url-map.json)")
    p.add_argument("--dry-run", action="store_true",
                    help="Print actions without executing them")
    p.add_argument("--verbose", action="store_true",
                    help="Show every git/npm/opencode command as it runs")
    args = p.parse_args()

    runner = Runner(dry_run=args.dry_run, verbose=args.verbose)
    map_path = Path(args.map_path)

    if args.build_map:
        entries = build_map(runner, REPO_DIR, map_path)
        print(f"Wrote {len(entries)} entries to {map_path}")
        return

    print("Nothing to do — pass --build-map (see --help).")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ~/scripts && python3 -m pytest test_restore_help_urls.py -v`
Expected: PASS (25 tests)

- [ ] **Step 5: Commit**

```bash
cd ~/scripts
git add restore_help_urls.py test_restore_help_urls.py
git commit -m "feat: add build_map orchestration and --build-map CLI"
```

---

### Task 5: `build_prompt` — the opencode instruction text

**Files:**
- Modify: `/home/alexeieleusis/scripts/restore_help_urls.py`
- Modify: `/home/alexeieleusis/scripts/test_restore_help_urls.py`

**Interfaces:**
- Produces: `build_prompt(rule_name: str, knowledge_path: str, error_context: str | None = None) -> str`.

- [ ] **Step 1: Write the failing tests**

Append to `/home/alexeieleusis/scripts/test_restore_help_urls.py`:

```python
from restore_help_urls import build_prompt


def test_build_prompt_names_the_file_and_path():
    prompt = build_prompt("no-any-boundary", "catalog/T18-conversions-coercions.md")
    assert "src/rules/no-any-boundary.ts" in prompt
    assert "consistent-constructor-strategy.ts" in prompt
    assert 'knowledgeUrl("catalog/T18-conversions-coercions.md")' in prompt
    assert "{{url}}" in prompt
    assert "data" in prompt
    assert "Fix exactly one file" in prompt


def test_build_prompt_omits_error_context_by_default():
    prompt = build_prompt("no-any-boundary", "catalog/T18-conversions-coercions.md")
    assert "previous attempt" not in prompt


def test_build_prompt_includes_error_context_when_given():
    prompt = build_prompt(
        "no-any-boundary", "catalog/T18-conversions-coercions.md",
        error_context="TS2304: Cannot find name 'URL'.",
    )
    assert "previous attempt" in prompt
    assert "TS2304: Cannot find name 'URL'." in prompt
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ~/scripts && python3 -m pytest test_restore_help_urls.py -v`
Expected: FAIL with `ImportError: cannot import name 'build_prompt'`

- [ ] **Step 3: Write the implementation**

Add to `/home/alexeieleusis/scripts/restore_help_urls.py`, after `build_map`:

```python
def build_prompt(rule_name: str, knowledge_path: str, error_context: str | None = None) -> str:
    lines = [
        "You are working in the eslint-lensflow-plugin project. Fix exactly one file: "
        f"src/rules/{rule_name}.ts. Bring it in line with the help-URL convention used in "
        "src/rules/consistent-constructor-strategy.ts:",
        "",
        '1. Import `knowledgeUrl` from "../utils/knowledge-url.js" if not already imported.',
        "2. Declare (or reuse, if one already exists) a module-level constant set to "
        f'`knowledgeUrl("{knowledge_path}")`. Default the name to `URL` unless the file already '
        "uses the global `URL` (e.g. `new URL(...)`), in which case use `DOCS_URL` instead.",
        "3. Remove any hardcoded raw https://raw.githubusercontent.com/... URL string in this "
        "file, and remove any import of a shared `*_URL` constant from another utils file (e.g. "
        "ASYNC_ITERATION_URL) if this rule was using one; replace both with the local "
        "knowledgeUrl() constant instead.",
        "4. Every message in `messages: { ... }` that links to docs must end with the literal "
        '`See: {{url}}` (normalize concatenation-style or differently-worded "See" text into '
        "this form; do not duplicate it).",
        "5. Every `context.report(...)` call for such a messageId must include `url: <constName>` "
        "in its `data` object, merged with any existing data fields.",
        "6. Do not change anything else in the file: no unrelated refactors, no touching other "
        "rules.",
        "",
        f"Knowledge path to use verbatim: {knowledge_path}",
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

Run: `cd ~/scripts && python3 -m pytest test_restore_help_urls.py -v`
Expected: PASS (28 tests)

- [ ] **Step 5: Commit**

```bash
cd ~/scripts
git add restore_help_urls.py test_restore_help_urls.py
git commit -m "feat: add build_prompt for opencode instructions"
```

---

### Task 6: `verify_file` — typecheck + targeted vitest run

**Files:**
- Modify: `/home/alexeieleusis/scripts/restore_help_urls.py`
- Modify: `/home/alexeieleusis/scripts/test_restore_help_urls.py`

**Interfaces:**
- Consumes: `Runner.npm`, `Runner.npx` (Task 3).
- Produces: `verify_file(runner: Runner, rule_name: str) -> tuple[bool, str]`.

- [ ] **Step 1: Write the failing tests**

Append to `/home/alexeieleusis/scripts/test_restore_help_urls.py`:

```python
from restore_help_urls import verify_file


def test_verify_file_dry_run_passes_and_runs_expected_commands(capsys):
    r = Runner(dry_run=True)
    ok, output = verify_file(r, "no-any-boundary")
    assert ok is True
    assert output == ""
    captured = capsys.readouterr()
    assert "npm run typecheck" in captured.out
    assert "npx vitest run tests/rules/no-any-boundary.test.ts" in captured.out
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ~/scripts && python3 -m pytest test_restore_help_urls.py -v`
Expected: FAIL with `ImportError: cannot import name 'verify_file'`

- [ ] **Step 3: Write the implementation**

Add to `/home/alexeieleusis/scripts/restore_help_urls.py`, after `build_prompt`:

```python
def verify_file(runner: "Runner", rule_name: str) -> tuple[bool, str]:
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

Run: `cd ~/scripts && python3 -m pytest test_restore_help_urls.py -v`
Expected: PASS (29 tests)

- [ ] **Step 5: Commit**

```bash
cd ~/scripts
git add restore_help_urls.py test_restore_help_urls.py
git commit -m "feat: add verify_file for typecheck + targeted vitest run"
```

---

### Task 7: `apply_one` — per-file opencode/verify/retry/commit state machine

**Files:**
- Modify: `/home/alexeieleusis/scripts/restore_help_urls.py`
- Modify: `/home/alexeieleusis/scripts/test_restore_help_urls.py`

**Interfaces:**
- Consumes: `Runner`, `build_prompt`, `verify_file` (Tasks 3, 5, 6).
- Produces: `apply_one(runner: Runner, entry: dict, max_retries: int, verify_fn: Callable[[Runner, str], tuple[bool, str]] = verify_file) -> tuple[bool, str]` (returns `(succeeded, last_error)`).

- [ ] **Step 1: Write the failing tests**

Append to `/home/alexeieleusis/scripts/test_restore_help_urls.py`:

```python
from restore_help_urls import apply_one

ENTRY = {
    "rule": "no-any-boundary",
    "knowledge_path": "catalog/T18-conversions-coercions.md",
    "source": "raw-url",
    "cleanup_util": None,
}


def test_apply_one_succeeds_first_try(capsys):
    def always_pass(_runner, _rule_name):
        return True, ""

    ok, error = apply_one(Runner(dry_run=True), ENTRY, max_retries=3, verify_fn=always_pass)

    assert ok is True
    assert error == ""
    captured = capsys.readouterr()
    assert "git add eslint-lensflow-plugin/src/rules/no-any-boundary.ts" in captured.out
    assert "git commit -m fix: restore help URL in no-any-boundary" in captured.out
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
    assert "git restore eslint-lensflow-plugin/src/rules/no-any-boundary.ts" in captured.out
    assert "git commit" not in captured.out
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ~/scripts && python3 -m pytest test_restore_help_urls.py -v`
Expected: FAIL with `ImportError: cannot import name 'apply_one'`

- [ ] **Step 3: Write the implementation**

Add to `/home/alexeieleusis/scripts/restore_help_urls.py`, after `verify_file`:

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
            runner.git("commit", "-m", f"fix: restore help URL in {rule_name}", check=False)
            return True, ""

        error_context = output
        print(f"  [retry {attempt}/{max_retries}] {rule_name} failed verification")

    runner.git("restore", rule_path, check=False)
    return False, error_context or ""
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ~/scripts && python3 -m pytest test_restore_help_urls.py -v`
Expected: PASS (32 tests)

- [ ] **Step 5: Commit**

```bash
cd ~/scripts
git add restore_help_urls.py test_restore_help_urls.py
git commit -m "feat: add apply_one retry/verify/commit state machine"
```

---

### Task 8: `apply_map`, shared-util cleanup, `filter_entries`, and full `--apply` CLI

**Files:**
- Modify: `/home/alexeieleusis/scripts/restore_help_urls.py`
- Modify: `/home/alexeieleusis/scripts/test_restore_help_urls.py`

**Interfaces:**
- Consumes: `apply_one`, `Runner` (Tasks 3, 7).
- Produces: `filter_entries(entries: list[dict], start: str | None, end: str | None) -> list[dict]`, `_remove_export_const(text: str, const_name: str) -> str`, `cleanup_shared_util(runner: Runner, entries: list[dict], repo_dir: Path) -> None`, `apply_map(runner: Runner, entries: list[dict], max_retries: int, manual_review_path: Path, repo_dir: Path) -> tuple[int, int]`, updated `main()` with `--apply`, `--start`, `--end`, `--max-retries`, `--manual-review-path`.

- [ ] **Step 1: Write the failing tests**

Append to `/home/alexeieleusis/scripts/test_restore_help_urls.py`:

```python
from restore_help_urls import (
    filter_entries, _remove_export_const, cleanup_shared_util, apply_map,
)


# ── filter_entries ─────────────────────────────────────────────────────────────

ENTRIES = [
    {"rule": "no-any-boundary", "knowledge_path": "x", "source": "raw-url", "cleanup_util": None},
    {"rule": "no-any-cast-chain", "knowledge_path": "x", "source": "raw-url", "cleanup_util": None},
    {"rule": "no-any-parameter", "knowledge_path": "x", "source": "raw-url", "cleanup_util": None},
    {"rule": "prefer-record-over-index-signature", "knowledge_path": "x", "source": "raw-url", "cleanup_util": None},
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


# ── _remove_export_const ────────────────────────────────────────────────────────

def test_remove_export_const_strips_declaration_and_keeps_rest():
    text = (
        'import ts from "typescript";\n'
        '\n'
        'export const ASYNC_ITERATION_URL =\n'
        '  "https://raw.githubusercontent.com/jpablo/vibe-types/'
        'ebff3754e7ddc862d05c3cd1a19480bdf52dfc25/plugin/skills/typescript/'
        'catalog/T64-async-iteration.md";\n'
        '\n'
        'export function hasAsyncIteratorSignature() {}\n'
    )
    result = _remove_export_const(text, "ASYNC_ITERATION_URL")
    assert "ASYNC_ITERATION_URL" not in result
    assert "export function hasAsyncIteratorSignature() {}" in result
    assert 'import ts from "typescript";' in result


# ── cleanup_shared_util ──────────────────────────────────────────────────────────

def test_cleanup_shared_util_removes_when_no_longer_referenced(tmp_path, monkeypatch):
    rules_dir = tmp_path / "src" / "rules"
    utils_dir = tmp_path / "src" / "utils"
    rules_dir.mkdir(parents=True)
    utils_dir.mkdir(parents=True)

    (rules_dir / "no-collect-then-sync-iterate.ts").write_text(
        'const URL = knowledgeUrl("catalog/T64-async-iteration.md");\n', encoding="utf-8",
    )
    (rules_dir / "no-collect-then-transform.ts").write_text(
        'const URL = knowledgeUrl("catalog/T64-async-iteration.md");\n', encoding="utf-8",
    )
    (utils_dir / "async-iteration.ts").write_text(SHARED_UTIL_FILE_TEXT, encoding="utf-8")

    entries = [
        {"rule": "no-collect-then-sync-iterate", "knowledge_path": "catalog/T64-async-iteration.md",
         "source": "shared-util-const", "cleanup_util": "../utils/async-iteration.js"},
        {"rule": "no-collect-then-transform", "knowledge_path": "catalog/T64-async-iteration.md",
         "source": "shared-util-const", "cleanup_util": "../utils/async-iteration.js"},
    ]

    captured_cmds = []

    def fake_run(cmd, cwd=None, capture_output=False, text=False):
        captured_cmds.append(cmd)
        return subprocess.CompletedProcess(cmd, 0, stdout="", stderr="")

    monkeypatch.setattr(subprocess, "run", fake_run)

    cleanup_shared_util(Runner(dry_run=False), entries, tmp_path)

    remaining = (utils_dir / "async-iteration.ts").read_text(encoding="utf-8")
    assert "ASYNC_ITERATION_URL" not in remaining
    assert ["git", "add", "eslint-lensflow-plugin/src/utils/async-iteration.ts"] in captured_cmds
    assert any(
        c[:3] == ["git", "commit", "-m"] and "remove unused ASYNC_ITERATION_URL constant" in c[3]
        for c in captured_cmds
    )


def test_cleanup_shared_util_dry_run_makes_no_real_write(tmp_path, capsys):
    rules_dir = tmp_path / "src" / "rules"
    utils_dir = tmp_path / "src" / "utils"
    rules_dir.mkdir(parents=True)
    utils_dir.mkdir(parents=True)

    (rules_dir / "no-collect-then-sync-iterate.ts").write_text(
        'const URL = knowledgeUrl("catalog/T64-async-iteration.md");\n', encoding="utf-8",
    )
    (rules_dir / "no-collect-then-transform.ts").write_text(
        'const URL = knowledgeUrl("catalog/T64-async-iteration.md");\n', encoding="utf-8",
    )
    (utils_dir / "async-iteration.ts").write_text(SHARED_UTIL_FILE_TEXT, encoding="utf-8")

    entries = [
        {"rule": "no-collect-then-sync-iterate", "knowledge_path": "catalog/T64-async-iteration.md",
         "source": "shared-util-const", "cleanup_util": "../utils/async-iteration.js"},
        {"rule": "no-collect-then-transform", "knowledge_path": "catalog/T64-async-iteration.md",
         "source": "shared-util-const", "cleanup_util": "../utils/async-iteration.js"},
    ]

    cleanup_shared_util(Runner(dry_run=True), entries, tmp_path)

    remaining = (utils_dir / "async-iteration.ts").read_text(encoding="utf-8")
    assert remaining == SHARED_UTIL_FILE_TEXT
    captured = capsys.readouterr()
    assert "would remove ASYNC_ITERATION_URL" in captured.out


def test_cleanup_shared_util_skips_when_still_referenced(tmp_path, capsys):
    rules_dir = tmp_path / "src" / "rules"
    utils_dir = tmp_path / "src" / "utils"
    rules_dir.mkdir(parents=True)
    utils_dir.mkdir(parents=True)

    (rules_dir / "no-collect-then-sync-iterate.ts").write_text(
        'const URL = knowledgeUrl("catalog/T64-async-iteration.md");\n', encoding="utf-8",
    )
    (rules_dir / "no-collect-then-transform.ts").write_text(
        SHARED_UTIL_RULE_TEXT, encoding="utf-8",
    )
    (utils_dir / "async-iteration.ts").write_text(SHARED_UTIL_FILE_TEXT, encoding="utf-8")

    entries = [
        {"rule": "no-collect-then-sync-iterate", "knowledge_path": "catalog/T64-async-iteration.md",
         "source": "shared-util-const", "cleanup_util": "../utils/async-iteration.js"},
    ]

    cleanup_shared_util(Runner(dry_run=True), entries, tmp_path)

    remaining = (utils_dir / "async-iteration.ts").read_text(encoding="utf-8")
    assert "ASYNC_ITERATION_URL" in remaining
    captured = capsys.readouterr()
    assert "git commit" not in captured.out


# ── apply_map ────────────────────────────────────────────────────────────────────

def test_apply_map_counts_success_and_failure_and_writes_manual_review(tmp_path, monkeypatch):
    import restore_help_urls

    def fake_apply_one(_runner, entry, _max_retries, verify_fn=None):
        if entry["rule"] == "good-rule":
            return True, ""
        return False, "boom"

    monkeypatch.setattr(restore_help_urls, "apply_one", fake_apply_one)
    monkeypatch.setattr(restore_help_urls, "cleanup_shared_util", lambda *a, **k: None)

    entries = [
        {"rule": "good-rule", "knowledge_path": "x", "source": "raw-url", "cleanup_util": None},
        {"rule": "bad-rule", "knowledge_path": "x", "source": "raw-url", "cleanup_util": None},
    ]
    manual_review_path = tmp_path / "needs-manual-review.txt"

    succeeded, failed = apply_map(Runner(dry_run=True), entries, 3, manual_review_path, tmp_path)

    assert (succeeded, failed) == (1, 1)
    assert "bad-rule" in manual_review_path.read_text(encoding="utf-8")
    assert "boom" in manual_review_path.read_text(encoding="utf-8")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ~/scripts && python3 -m pytest test_restore_help_urls.py -v`
Expected: FAIL with `ImportError: cannot import name 'filter_entries'`

- [ ] **Step 3: Write the implementation**

Add to `/home/alexeieleusis/scripts/restore_help_urls.py`, after `apply_one`:

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


def _remove_export_const(text: str, const_name: str) -> str:
    pattern = re.compile(
        rf'^export const {re.escape(const_name)} =\s*"[^"]*";\n',
        re.MULTILINE,
    )
    return pattern.sub("", text, count=1)


def cleanup_shared_util(runner: "Runner", entries: list[dict], repo_dir: Path) -> None:
    rules_dir = repo_dir / "src" / "rules"
    cleanup_targets = {e["cleanup_util"] for e in entries if e.get("cleanup_util")}

    for import_path in cleanup_targets:
        util_file = (rules_dir / import_path).resolve().with_suffix(".ts")
        if not util_file.exists():
            continue

        text = util_file.read_text(encoding="utf-8")
        m = re.search(r"export const (\w+_URL) =", text)
        if not m:
            continue
        const_name = m.group(1)

        still_used = any(
            const_name in p.read_text(encoding="utf-8")
            for p in rules_dir.glob("*.ts")
        )
        if still_used:
            continue

        new_text = _remove_export_const(text, const_name)
        if new_text == text:
            continue

        rel_util = Path("eslint-lensflow-plugin") / util_file.relative_to(repo_dir)
        if runner.dry_run:
            print(f"  $ (dry-run) would remove {const_name} from {rel_util}")
            continue
        util_file.write_text(new_text, encoding="utf-8")

        runner.git("add", str(rel_util))
        runner.git("commit", "-m", f"fix: remove unused {const_name} constant", check=False)


def apply_map(
    runner: "Runner",
    entries: list[dict],
    max_retries: int,
    manual_review_path: Path,
    repo_dir: Path,
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

    cleanup_shared_util(runner, entries, repo_dir)

    return succeeded, failed
```

Replace the `main()` function with the full CLI:

```python
def main() -> None:
    p = argparse.ArgumentParser(
        description="Restore help URLs across eslint-lensflow-plugin/src/rules/*.ts"
    )
    p.add_argument("--build-map", action="store_true",
                    help="Scan src/rules/, write url-map.json, and exit")
    p.add_argument("--apply", action="store_true",
                    help="Apply fixes from the map file via opencode")
    p.add_argument("--map-path", default="url-map.json", metavar="PATH",
                    help="Path to the map JSON file (default: url-map.json)")
    p.add_argument("--manual-review-path", default="needs-manual-review.txt", metavar="PATH",
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
        entries = build_map(runner, REPO_DIR, map_path)
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
            runner, entries, args.max_retries, Path(args.manual_review_path), REPO_DIR,
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

Run: `cd ~/scripts && python3 -m pytest test_restore_help_urls.py -v`
Expected: PASS (39 tests)

- [ ] **Step 5: Commit**

```bash
cd ~/scripts
git add restore_help_urls.py test_restore_help_urls.py
git commit -m "feat: add apply_map, shared-util cleanup, and full --apply CLI"
```

---

### Task 9: Manual end-to-end smoke test against the real repo

**Files:**
- None created/modified — this task exercises the finished script against the real `eslint-lensflow-plugin` repo.

**Interfaces:**
- Consumes: the complete `restore_help_urls.py` CLI (Tasks 1–8).

- [ ] **Step 1: Confirm the working tree is clean**

Run: `cd /home/alexeieleusis/second_ssd/development/lensflow/eslint-lensflow-plugin && git status --short`
Expected: no output (clean tree). If not clean, stop and resolve before continuing.

- [ ] **Step 2: Build the real map**

Run:
```bash
cd ~/scripts
python3 restore_help_urls.py --build-map \
  --map-path /tmp/claude-1000/-home-alexeieleusis-second-ssd-development-lensflow-eslint-lensflow-plugin/b4538fc0-3c24-472f-afab-288f45017c09/scratchpad/url-map.json
```
Expected: `Wrote 244 entries to /tmp/.../url-map.json` (no `[warn] could not resolve` lines).

- [ ] **Step 3: Sanity-check the map's source-label counts**

Run:
```bash
python3 -c "
import json
entries = json.load(open('/tmp/claude-1000/-home-alexeieleusis-second-ssd-development-lensflow-eslint-lensflow-plugin/b4538fc0-3c24-472f-afab-288f45017c09/scratchpad/url-map.json'))
from collections import Counter
print(Counter(e['source'] for e in entries))
print(len(entries))
"
```
Expected: `Counter({'raw-url': 222, 'concat-style': 5, 'missing-recovered': 15, 'shared-util-const': 2})` and `244`.

- [ ] **Step 4: Dry-run `--apply` on a small known slice to inspect the generated prompts**

Run:
```bash
cd /home/alexeieleusis/second_ssd/development/lensflow/eslint-lensflow-plugin
python3 ~/scripts/restore_help_urls.py --apply --dry-run --verbose \
  --map-path /tmp/claude-1000/-home-alexeieleusis-second-ssd-development-lensflow-eslint-lensflow-plugin/b4538fc0-3c24-472f-afab-288f45017c09/scratchpad/url-map.json \
  --start no-collect-then-sync-iterate --end no-collect-then-transform
```
Expected: prints `git status --porcelain`, then for each of the two matched rules a `[1/2]`/`[2/2]` header, an `opencode run ...` line whose prompt mentions `src/rules/no-collect-then-sync-iterate.ts` (or `-transform`) and `catalog/T64-async-iteration.md`, followed by `npm run typecheck`, `npx vitest run tests/rules/<rule>.test.ts`, and `git add`/`git commit` lines (dry-run, so nothing is actually written or committed) — then a final `Done. 2 fixed, 0 failed.` line, then the shared-util cleanup dry-run commands for `async-iteration.ts`.

- [ ] **Step 5: Confirm no real changes were made**

Run: `cd /home/alexeieleusis/second_ssd/development/lensflow/eslint-lensflow-plugin && git status --short`
Expected: no output (dry-run made no real changes).

- [ ] **Step 6: Report readiness**

No commit for this task (it's read-only verification). Report back: the map's real counts matched expectations and the dry-run prompts look correct — the script is ready for a real `--apply` run (which the user should trigger explicitly, given it will spend ~244 opencode invocations and create ~245 commits).
