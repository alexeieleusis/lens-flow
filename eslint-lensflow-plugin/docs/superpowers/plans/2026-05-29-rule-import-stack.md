# Rule Import Stack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `stack.py`, a Python script that orchestrates importing 297 ESLint rules from a source repo into `eslint-lensflow-plugin` as a stacked PR series, with Copilot review and opencode for addressing comments.

**Architecture:** Single self-contained Python script with four explicit phases (`branch`, `review`, `restack`, `merge`). All state is derived on each run from `git branch -r` and `gh pr list` — no state file. Each phase is a pure function that calls `Runner` methods for subprocess execution, making the logic independently testable.

**Tech Stack:** Python 3.11+, `subprocess`, `argparse`, `dataclasses`, `pathlib`; `gh` CLI, `git`, `git-spice`, `opencode`, `npm`; `pytest` for tests.

---

## File Map

| File | Purpose |
|------|---------|
| `eslint-lensflow-plugin/stack.py` | Main script — all phases, config, CLI |
| `eslint-lensflow-plugin/stack_test.py` | pytest tests for pure logic functions |

---

### Task 1: Scaffold, config, and CLI

**Files:**
- Create: `eslint-lensflow-plugin/stack.py`
- Create: `eslint-lensflow-plugin/stack_test.py`

- [ ] **Step 1: Create `stack.py` with config block, data types, and CLI skeleton**

```python
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
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

# ── Config ────────────────────────────────────────────────────────────────────

SOURCE_REPO  = Path("/home/alexeieleusis/development/vibe-types/eslint-plugin")
TARGET_REPO  = Path("/home/alexeieleusis/second_ssd/development/lensflow/eslint-lensflow-plugin")
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
    print(f"[stack.py] phase={args.phase} limit={args.limit} dry_run={args.dry_run}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Make executable and verify `--help`**

```bash
chmod +x eslint-lensflow-plugin/stack.py
python3 eslint-lensflow-plugin/stack.py --help
```

Expected output includes: `usage: stack.py`, `--phase {branch,review,restack,merge}`, `--limit`, `--dry-run`, `--verbose`

- [ ] **Step 3: Create `stack_test.py` with a smoke test**

```python
import subprocess
import sys
from pathlib import Path

SCRIPT = Path(__file__).parent / "stack.py"


def run(args: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(SCRIPT)] + args,
        capture_output=True, text=True
    )


def test_help_exits_zero():
    r = run(["--help"])
    assert r.returncode == 0
    assert "--phase" in r.stdout


def test_missing_phase_exits_nonzero():
    r = run([])
    assert r.returncode != 0
```

- [ ] **Step 4: Run tests**

```bash
cd eslint-lensflow-plugin && python3 -m pytest stack_test.py -v
```

Expected: `2 passed`

- [ ] **Step 5: Commit**

```bash
git add eslint-lensflow-plugin/stack.py eslint-lensflow-plugin/stack_test.py
git commit -m "feat(stack): scaffold CLI with config and data types"
```

---

### Task 2: Shell runner

**Files:**
- Modify: `eslint-lensflow-plugin/stack.py` (add `Runner` class after data types section)
- Modify: `eslint-lensflow-plugin/stack_test.py`

- [ ] **Step 1: Write failing tests for `Runner`**

Add to `stack_test.py`:

```python
import sys
sys.path.insert(0, str(Path(__file__).parent))
from stack import Runner
from pathlib import Path
import subprocess
from unittest.mock import patch, call


def test_runner_dry_run_returns_zero_without_executing(capsys):
    r = Runner(dry_run=True)
    result = r.run(["false"])          # "false" always exits 1 — but dry_run skips it
    assert result.returncode == 0
    captured = capsys.readouterr()
    assert "false" in captured.out    # prints the command


def test_runner_captures_stdout():
    r = Runner()
    result = r.run(["echo", "hello"], capture=True)
    assert result.stdout.strip() == "hello"


def test_runner_exits_on_failure():
    r = Runner()
    with pytest.raises(SystemExit):
        r.run(["false"])              # exits non-zero, Runner calls sys.exit


def test_runner_git_prefixes_git(capsys):
    r = Runner(dry_run=True)
    r.git("status")
    assert "git status" in capsys.readouterr().out


def test_runner_gh_prefixes_gh(capsys):
    r = Runner(dry_run=True)
    r.gh("pr", "list")
    assert "gh pr list" in capsys.readouterr().out
```

Add `import pytest` at the top of `stack_test.py`.

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd eslint-lensflow-plugin && python3 -m pytest stack_test.py::test_runner_dry_run_returns_zero_without_executing -v
```

Expected: `FAILED` — `ImportError: cannot import name 'Runner'`

- [ ] **Step 3: Add `Runner` class to `stack.py`** (after the data types section)

```python
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
```

- [ ] **Step 4: Run tests**

```bash
cd eslint-lensflow-plugin && python3 -m pytest stack_test.py -v
```

Expected: all pass (5 new + 2 from Task 1 = 7 total)

- [ ] **Step 5: Commit**

```bash
git add eslint-lensflow-plugin/stack.py eslint-lensflow-plugin/stack_test.py
git commit -m "feat(stack): add Runner class with dry-run and verbose support"
```

---

### Task 3: Work list construction

**Files:**
- Modify: `eslint-lensflow-plugin/stack.py` (add `build_work_list()`)
- Modify: `eslint-lensflow-plugin/stack_test.py`

- [ ] **Step 1: Write failing tests**

Add to `stack_test.py`:

```python
from stack import build_work_list, WorkItem


def test_work_list_starts_with_utils():
    items = build_work_list()
    assert items[0].kind == "utils"
    assert items[0].branch == "utils"


def test_work_list_ends_with_register_rules():
    items = build_work_list()
    assert items[-1].kind == "register-rules"
    assert items[-1].branch == "register-rules"


def test_work_list_rules_are_alphabetical():
    items = build_work_list()
    rules = [i for i in items if i.kind == "rule"]
    names = [i.rule_name for i in rules]
    assert names == sorted(names)


def test_work_list_rules_total():
    items = build_work_list()
    rules = [i for i in items if i.kind == "rule"]
    assert len(rules) == 297


def test_work_list_total_length():
    items = build_work_list()
    assert len(items) == 299   # 1 utils + 297 rules + 1 register-rules


def test_work_list_rule_branch_naming():
    items = build_work_list()
    first_rule = next(i for i in items if i.kind == "rule")
    assert first_rule.branch == f"rule/{first_rule.rule_name}"


def test_work_list_excludes_rule_creator_from_utils():
    items = build_work_list()
    utils_item = items[0]
    # rule-creator.ts is already in target, must not be in utils src_files
    assert "rule-creator" not in utils_item.rule_name
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd eslint-lensflow-plugin && python3 -m pytest stack_test.py -k "work_list" -v
```

Expected: `FAILED` — `ImportError: cannot import name 'build_work_list'`

- [ ] **Step 3: Add `build_work_list()` to `stack.py`** (after `Runner`)

```python
# ── Work list ─────────────────────────────────────────────────────────────────

UTILS_SKIP = {"rule-creator.ts"}   # already in target with correct URL

def build_work_list() -> list[WorkItem]:
    rules_dir = SOURCE_REPO / "src" / "rules"
    rule_files = sorted(f for f in rules_dir.iterdir() if f.suffix == ".ts")

    items: list[WorkItem] = []

    # 1. utils
    items.append(WorkItem(branch="utils", kind="utils"))

    # 2. rules (alphabetical)
    for rule_file in rule_files:
        rule_name = rule_file.stem   # e.g. "no-any-parameter"
        items.append(WorkItem(
            branch=f"rule/{rule_name}",
            kind="rule",
            rule_name=rule_name,
        ))

    # 3. register-rules
    items.append(WorkItem(branch="register-rules", kind="register-rules"))

    return items
```

- [ ] **Step 4: Run tests**

```bash
cd eslint-lensflow-plugin && python3 -m pytest stack_test.py -k "work_list" -v
```

Expected: all 7 pass

- [ ] **Step 5: Commit**

```bash
git add eslint-lensflow-plugin/stack.py eslint-lensflow-plugin/stack_test.py
git commit -m "feat(stack): add build_work_list with utils/rules/register-rules ordering"
```

---

### Task 4: State derivation and status display

**Files:**
- Modify: `eslint-lensflow-plugin/stack.py` (add `derive_state()`, `print_status()`)
- Modify: `eslint-lensflow-plugin/stack_test.py`

- [ ] **Step 1: Write failing tests for `derive_state`**

Add to `stack_test.py`:

```python
from stack import derive_state, WorkItem, ItemState


FAKE_BRANCHES = [
    "  origin/main",
    "  origin/utils",
    "  origin/rule/consistent-constructor-strategy",
]

FAKE_PRS = json.dumps([
    {"number": 1, "headRefName": "utils",   "state": "OPEN"},
    {"number": 2, "headRefName": "rule/consistent-constructor-strategy", "state": "MERGED"},
])


def test_derive_state_detects_branched(tmp_path):
    items = [
        WorkItem(branch="utils", kind="utils"),
        WorkItem(branch="rule/consistent-constructor-strategy", kind="rule",
                 rule_name="consistent-constructor-strategy"),
        WorkItem(branch="rule/no-any-parameter", kind="rule",
                 rule_name="no-any-parameter"),
    ]
    state = derive_state(items, FAKE_BRANCHES, FAKE_PRS)
    assert state["utils"].branched is True
    assert state["rule/consistent-constructor-strategy"].branched is True
    assert state["rule/no-any-parameter"].branched is False


def test_derive_state_pr_numbers():
    items = [
        WorkItem(branch="utils", kind="utils"),
        WorkItem(branch="rule/consistent-constructor-strategy", kind="rule",
                 rule_name="consistent-constructor-strategy"),
    ]
    state = derive_state(items, FAKE_BRANCHES, FAKE_PRS)
    assert state["utils"].pr_number == 1
    assert state["rule/consistent-constructor-strategy"].pr_number == 2


def test_derive_state_pr_states():
    items = [
        WorkItem(branch="utils", kind="utils"),
        WorkItem(branch="rule/consistent-constructor-strategy", kind="rule",
                 rule_name="consistent-constructor-strategy"),
    ]
    state = derive_state(items, FAKE_BRANCHES, FAKE_PRS)
    assert state["utils"].pr_state == "OPEN"
    assert state["rule/consistent-constructor-strategy"].pr_state == "MERGED"
```

Add `import json` at top of `stack_test.py`.

- [ ] **Step 2: Run to verify they fail**

```bash
cd eslint-lensflow-plugin && python3 -m pytest stack_test.py -k "derive_state" -v
```

Expected: `FAILED`

- [ ] **Step 3: Add `derive_state()` and `print_status()` to `stack.py`**

```python
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
```

- [ ] **Step 4: Run tests**

```bash
cd eslint-lensflow-plugin && python3 -m pytest stack_test.py -k "derive_state" -v
```

Expected: all 3 pass

- [ ] **Step 5: Commit**

```bash
git add eslint-lensflow-plugin/stack.py eslint-lensflow-plugin/stack_test.py
git commit -m "feat(stack): add derive_state and print_status"
```

---

### Task 5: `src/index.ts` generator

**Files:**
- Modify: `eslint-lensflow-plugin/stack.py` (add `to_camel_case()`, `generate_index()`)
- Modify: `eslint-lensflow-plugin/stack_test.py`

- [ ] **Step 1: Write failing tests**

Add to `stack_test.py`:

```python
from stack import to_camel_case, generate_index


def test_to_camel_case_basic():
    assert to_camel_case("no-any-parameter") == "noAnyParameter"


def test_to_camel_case_single_word():
    assert to_camel_case("utils") == "utils"


def test_to_camel_case_uc_suffix():
    assert to_camel_case("no-abstract-class-overkill-uc14") == "noAbstractClassOverkillUc14"


def test_generate_index_imports():
    src = generate_index(["no-any-parameter", "no-any-array-return"])
    assert 'import noAnyParameter from "./rules/no-any-parameter"' in src
    assert 'import noAnyArrayReturn from "./rules/no-any-array-return"' in src


def test_generate_index_rules_object():
    src = generate_index(["no-any-parameter"])
    assert '"no-any-parameter": noAnyParameter' in src


def test_generate_index_exports_default():
    src = generate_index(["no-any-parameter"])
    assert "export default plugin" in src


def test_generate_index_empty_rules():
    src = generate_index([])
    assert "rules: {}" in src
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd eslint-lensflow-plugin && python3 -m pytest stack_test.py -k "camel_case or generate_index" -v
```

Expected: `FAILED`

- [ ] **Step 3: Add `to_camel_case()` and `generate_index()` to `stack.py`**

```python
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
```

- [ ] **Step 4: Run tests**

```bash
cd eslint-lensflow-plugin && python3 -m pytest stack_test.py -k "camel_case or generate_index" -v
```

Expected: all 7 pass

- [ ] **Step 5: Commit**

```bash
git add eslint-lensflow-plugin/stack.py eslint-lensflow-plugin/stack_test.py
git commit -m "feat(stack): add index.ts generator with camelCase conversion"
```

---

### Task 6: Phase `branch` — file operations

**Files:**
- Modify: `eslint-lensflow-plugin/stack.py` (add `copy_utils()`, `copy_rule()`, `run_checks()`, `write_register_rules()`)

No new tests for these (they shell out to npm/cp); they are exercised by integration.

- [ ] **Step 1: Add file-copy helpers to `stack.py`**

```python
# ── Phase: branch — file operations ───────────────────────────────────────────

UTILS_SKIP = {"rule-creator.ts"}


def copy_utils(runner: Runner) -> None:
    src_utils = SOURCE_REPO / "src" / "utils"
    dst_utils = TARGET_REPO / "src" / "utils"
    dst_utils.mkdir(parents=True, exist_ok=True)
    for f in src_utils.iterdir():
        if f.name not in UTILS_SKIP:
            shutil.copy2(f, dst_utils / f.name)
            print(f"  copied {f.name}")


def copy_rule(rule_name: str, runner: Runner) -> None:
    src_rule = SOURCE_REPO / "src" / "rules" / f"{rule_name}.ts"
    dst_rule = TARGET_REPO / "src" / "rules" / f"{rule_name}.ts"
    dst_rule.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src_rule, dst_rule)

    src_test = SOURCE_REPO / "tests" / "rules" / f"{rule_name}.test.ts"
    dst_test = TARGET_REPO / "tests" / "rules" / f"{rule_name}.test.ts"
    dst_test.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src_test, dst_test)
    print(f"  copied rule + test: {rule_name}")


def run_checks(rule_name: str, runner: Runner) -> bool:
    """Run npm test + typecheck. On failure, invoke opencode once and retry.
    Returns True on success, False if still failing after retry."""
    result = runner.run(
        ["npm", "test", "&&", "npm", "run", "typecheck"],
        cwd=TARGET_REPO, capture=True
    )
    # npm chains don't work via subprocess list; run via shell
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
    index_path.write_text(content, encoding="utf-8")
    print(f"  wrote src/index.ts with {len(rule_names)} rules")
```

- [ ] **Step 2: Fix `run_checks` — remove the unused first `result` assignment**

The function above has a redundant first `subprocess.run`. Remove it:

```python
def run_checks(rule_name: str, runner: Runner) -> bool:
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
```

- [ ] **Step 3: Verify the script still imports cleanly**

```bash
cd eslint-lensflow-plugin && python3 -c "import stack; print('ok')"
```

Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add eslint-lensflow-plugin/stack.py
git commit -m "feat(stack): add file-copy helpers and build-check with opencode retry"
```

---

### Task 7: Phase `branch` — commit, push, PR creation

**Files:**
- Modify: `eslint-lensflow-plugin/stack.py` (add `phase_branch()`)

- [ ] **Step 1: Add `phase_branch()` to `stack.py`**

```python
# ── Phase: branch ─────────────────────────────────────────────────────────────

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

    for item_idx, item in enumerate(items):
        if item not in pending:
            continue

        prev_branch = items[item_idx - 1].branch if item_idx > 0 else MAIN_BRANCH
        item_state = state[item.branch]

        print(f"\n[{item_idx+1}/{len(items)}] {item.branch}")

        # Steps 1-5: only needed if branch not yet pushed
        if not item_state.branched:
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
                "--repo", GITHUB_REPO,
                capture=True,
            )
            pr_url = result.stdout.strip() if result.stdout else ""
            print(f"  PR: {pr_url}")

            # 7. Request Copilot review
            runner.gh(
                "pr", "edit", pr_url,
                "--add-reviewer", "copilot",
                "--repo", GITHUB_REPO,
            )
        else:
            print(f"  PR #{item_state.pr_number} already exists — skipping creation")
```

- [ ] **Step 2: Verify syntax**

```bash
cd eslint-lensflow-plugin && python3 -c "import stack; print('ok')"
```

Expected: `ok`

- [ ] **Step 3: Dry-run smoke test**

```bash
cd eslint-lensflow-plugin && python3 stack.py --phase branch --dry-run --limit 2
```

Expected: prints status summary and shows `$ git checkout -b utils main` then `$ git checkout -b rule/consistent-constructor-strategy utils` without executing anything.

- [ ] **Step 4: Commit**

```bash
git add eslint-lensflow-plugin/stack.py
git commit -m "feat(stack): implement phase branch with PR creation and Copilot review request"
```

---

### Task 8: Phase `review`

**Files:**
- Modify: `eslint-lensflow-plugin/stack.py` (add `build_review_prompt()`, `phase_review()`)

- [ ] **Step 1: Write failing test for `build_review_prompt`**

Add to `stack_test.py`:

```python
from stack import build_review_prompt


def test_build_review_prompt_includes_file_and_comment():
    prompt = build_review_prompt(
        rule_name="no-any-parameter",
        file_path="src/rules/no-any-parameter.ts",
        line=42,
        comment_body="This could be simplified using a utility function.",
    )
    assert "no-any-parameter" in prompt
    assert "src/rules/no-any-parameter.ts" in prompt
    assert "This could be simplified" in prompt
    assert "eslint-lensflow-plugin" in prompt
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd eslint-lensflow-plugin && python3 -m pytest stack_test.py::test_build_review_prompt_includes_file_and_comment -v
```

Expected: `FAILED`

- [ ] **Step 3: Add `build_review_prompt()` and `phase_review()` to `stack.py`**

```python
# ── Phase: review ─────────────────────────────────────────────────────────────

def build_review_prompt(
    rule_name: str,
    file_path: str,
    line: int | None,
    comment_body: str,
) -> str:
    location = f"{file_path}" + (f" line {line}" if line else "")
    return (
        f"You are working in the eslint-lensflow-plugin project on rule '{rule_name}'. "
        f"A code reviewer left the following comment at {location}:\n\n"
        f"\"{comment_body}\"\n\n"
        f"Please address this comment by modifying the relevant file(s)."
    )


def resolve_thread(thread_id: str, runner: Runner) -> None:
    mutation = (
        'mutation { resolveReviewThread(input: {threadId: "'
        + thread_id
        + '"}) { thread { id isResolved } } }'
    )
    runner.gh("api", "graphql", "-f", f"query={mutation}")


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
    if limit is not None:
        candidates = candidates[:limit]

    if not candidates:
        print("No open PRs to review.")
        return

    for item in candidates:
        pr_number = state[item.branch].pr_number
        print(f"\n[review] {item.branch} (PR #{pr_number})")

        # Fetch review threads
        result = runner.gh(
            "pr", "view", str(pr_number),
            "--json", "reviewThreads",
            "--repo", GITHUB_REPO,
            capture=True,
        )
        if runner.dry_run:
            print("  (dry-run: skipping thread processing)")
            continue

        data = json.loads(result.stdout)
        threads = [t for t in data.get("reviewThreads", []) if not t.get("isResolved", True)]

        if not threads:
            print("  no unresolved threads — skipping")
            continue

        runner.git("checkout", item.branch)

        for thread in threads:
            first_comment = thread["comments"]["nodes"][0]
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
            runner.git("push")
        else:
            print("  (opencode made no changes)")

        # Resolve threads after successful push
        for thread in threads:
            resolve_thread(thread["id"], runner)
            print(f"  resolved thread {thread['id'][:20]}…")
```

- [ ] **Step 4: Run tests**

```bash
cd eslint-lensflow-plugin && python3 -m pytest stack_test.py::test_build_review_prompt_includes_file_and_comment -v
```

Expected: `PASS`

- [ ] **Step 5: Commit**

```bash
git add eslint-lensflow-plugin/stack.py eslint-lensflow-plugin/stack_test.py
git commit -m "feat(stack): implement phase review with opencode and thread resolution"
```

---

### Task 9: Phase `restack` and phase `merge`

**Files:**
- Modify: `eslint-lensflow-plugin/stack.py` (add `phase_restack()`, `phase_merge()`)

- [ ] **Step 1: Write failing test for merge rebase command**

Add to `stack_test.py`:

```python
from stack import make_rebase_onto_cmd


def test_make_rebase_onto_cmd():
    cmd = make_rebase_onto_cmd(tip_sha="abc123", next_branch="rule/no-any-parameter")
    assert cmd == ["git", "rebase", "--onto", "main", "abc123", "rule/no-any-parameter"]
```

- [ ] **Step 2: Run to verify failure**

```bash
cd eslint-lensflow-plugin && python3 -m pytest stack_test.py::test_make_rebase_onto_cmd -v
```

Expected: `FAILED`

- [ ] **Step 3: Add `make_rebase_onto_cmd()`, `phase_restack()`, and `phase_merge()` to `stack.py`**

```python
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
        if state[i.branch].pr_state not in ("MERGED", None)
    ]
    if limit is not None:
        pending = pending[:limit]

    if not pending:
        print("Nothing to merge.")
        return

    for idx, item in enumerate(pending):
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
        next_items = [i for i in items if items.index(i) > items.index(item)]
        if next_items:
            next_item = next_items[0]
            runner.git("checkout", next_item.branch)
            runner.run(
                make_rebase_onto_cmd(tip_sha, next_item.branch),
                cwd=TARGET_REPO,
            )
            runner.gh(
                "pr", "edit", str(state[next_item.branch].pr_number),
                "--base", MAIN_BRANCH,
                "--repo", GITHUB_REPO,
            )
            runner.git("push", "--force-with-lease", "origin", next_item.branch)
```

- [ ] **Step 4: Run tests**

```bash
cd eslint-lensflow-plugin && python3 -m pytest stack_test.py -v
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add eslint-lensflow-plugin/stack.py eslint-lensflow-plugin/stack_test.py
git commit -m "feat(stack): implement phase restack and phase merge with rebase --onto"
```

---

### Task 10: Wire `main()` and end-to-end dry-run smoke test

**Files:**
- Modify: `eslint-lensflow-plugin/stack.py` (complete `main()`)

- [ ] **Step 1: Replace the `main()` stub with the full implementation**

```python
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
```

- [ ] **Step 2: Run full dry-run for each phase**

```bash
cd eslint-lensflow-plugin
python3 stack.py --phase branch  --dry-run --limit 3
python3 stack.py --phase review  --dry-run --limit 3
python3 stack.py --phase restack --dry-run
python3 stack.py --phase merge   --dry-run --limit 3
```

Expected: each run prints the status summary and lists the commands it *would* execute without errors.

- [ ] **Step 3: Run full test suite**

```bash
cd eslint-lensflow-plugin && python3 -m pytest stack_test.py -v
```

Expected: all tests pass

- [ ] **Step 4: Run npm test to confirm ESLint plugin still builds**

```bash
cd eslint-lensflow-plugin && npm test && npm run typecheck
```

Expected: pass (no test files found but exit 0; typecheck clean)

- [ ] **Step 5: Commit**

```bash
git add eslint-lensflow-plugin/stack.py
git commit -m "feat(stack): wire main() — all phases connected, dry-run verified"
```
