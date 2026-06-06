# review_stack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Python package that harvests Copilot review comments from PRs 2–178, distils them into a feedback guide via opencode, then uses that guide to review PRs 179–299 via opencode and post the results as GitHub PR comments.

**Architecture:** Three independent scripts (`gather`, `consolidate`, `review`) share a `utils.py` module and live in a Python package at `~/scripts/review_stack/`. A `__main__.py` dispatcher routes subcommands to the correct script. Data flows through files: `data/comments.json` → `data/feedback.md` → `data/reviews/pr-NNN.md`.

**Tech Stack:** Python 3.13, `gh` CLI (GitHub API), `git` CLI, `opencode` CLI, pytest 9.

---

## File Map

| Path | Purpose |
|------|---------|
| `~/scripts/review_stack/__main__.py` | Subcommand dispatcher (`gather` / `consolidate` / `review`) |
| `~/scripts/review_stack/utils.py` | `Runner`, constants, `load_prs`, `paginate_gh_api`, `is_copilot` |
| `~/scripts/review_stack/gather.py` | Phase 1: scrape Copilot comments → `data/comments.json` |
| `~/scripts/review_stack/consolidate.py` | Phase 2: fold comments into `data/feedback.md` via opencode |
| `~/scripts/review_stack/review.py` | Phase 3: review PRs via opencode, save + post results |
| `~/scripts/review_stack/test_review_stack.py` | All unit tests (pytest) |
| `~/scripts/review_stack/data/` | Runtime data directory (created on first run) |

---

## Task 1: Bootstrap the package

**Files:**
- Create: `~/scripts/review_stack/__main__.py`
- Create: `~/scripts/review_stack/utils.py` (stub)
- Create: `~/scripts/review_stack/gather.py` (stub)
- Create: `~/scripts/review_stack/consolidate.py` (stub)
- Create: `~/scripts/review_stack/review.py` (stub)
- Create: `~/scripts/review_stack/test_review_stack.py` (stub)

- [ ] **Step 1: Create the package directory and initialise git tracking**

```bash
mkdir -p ~/scripts/review_stack/data
cd ~/scripts && git init && echo "__pycache__/" > .gitignore && git add .gitignore && git commit -m "chore: init scripts repo"
```

- [ ] **Step 2: Write the dispatcher `__main__.py`**

```python
#!/usr/bin/env python3
"""
review_stack — Harvest Copilot feedback and review remaining PRs.

Usage:
  python ~/scripts/review_stack <subcommand> [options]

Subcommands:
  gather      Fetch Copilot comments from PRs 2-178  → data/comments.json
  consolidate Fold comments into a feedback guide     → data/feedback.md
  review      Review PRs 179-299 using feedback guide → data/reviews/

Run with --help for options, e.g.:
  python ~/scripts/review_stack gather --help
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

USAGE = __doc__


def main() -> None:
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
        print(USAGE)
        sys.exit(0)

    cmd = sys.argv[1]
    sys.argv = [f"review_stack {cmd}"] + sys.argv[2:]

    if cmd == "gather":
        from gather import main as run
    elif cmd == "consolidate":
        from consolidate import main as run
    elif cmd == "review":
        from review import main as run
    else:
        print(f"Unknown subcommand: {cmd!r}\n{USAGE}")
        sys.exit(1)

    run()


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Write stub files for the other modules**

`utils.py`:
```python
#!/usr/bin/env python3
```

`gather.py`:
```python
#!/usr/bin/env python3
def main() -> None:
    print("gather: not yet implemented")
```

`consolidate.py`:
```python
#!/usr/bin/env python3
def main() -> None:
    print("consolidate: not yet implemented")
```

`review.py`:
```python
#!/usr/bin/env python3
def main() -> None:
    print("review: not yet implemented")
```

`test_review_stack.py`:
```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
```

- [ ] **Step 4: Verify the package is invokable**

```bash
python ~/scripts/review_stack --help
```

Expected output includes `gather`, `consolidate`, `review` in the usage text.

```bash
python ~/scripts/review_stack gather
```

Expected: `gather: not yet implemented`

- [ ] **Step 5: Commit**

```bash
git -C ~/scripts add review_stack/
git -C ~/scripts commit -m "feat: bootstrap review_stack package structure"
```

---

## Task 2: `utils.py` — Runner, constants, shared helpers

**Files:**
- Modify: `~/scripts/review_stack/utils.py`
- Modify: `~/scripts/review_stack/test_review_stack.py`

- [ ] **Step 1: Write failing tests for `Runner` and `is_copilot`**

Append to `test_review_stack.py`:

```python
import subprocess
import pytest
from utils import Runner, is_copilot, GITHUB_REPO, REPO_DIR, SCRIPTS_DIR


# ── Runner ────────────────────────────────────────────────────────────────────

def test_runner_dry_run_returns_zero_without_executing(capsys):
    r = Runner(dry_run=True)
    result = r.run(["false"])
    assert result.returncode == 0
    captured = capsys.readouterr()
    assert "false" in captured.out


def test_runner_captures_stdout():
    r = Runner()
    result = r.run(["echo", "hello"], capture=True)
    assert result.stdout.strip() == "hello"


def test_runner_exits_on_failure():
    r = Runner()
    with pytest.raises(SystemExit):
        r.run(["false"])


def test_runner_git_prefixes_git(capsys):
    r = Runner(dry_run=True)
    r.git("status")
    assert "git status" in capsys.readouterr().out


def test_runner_gh_prefixes_gh(capsys):
    r = Runner(dry_run=True)
    r.gh("pr", "list")
    assert "gh pr list" in capsys.readouterr().out


def test_runner_dry_run_stdout_is_empty_list():
    r = Runner(dry_run=True)
    result = r.run(["anything"], capture=True)
    assert result.stdout == "[]"


# ── is_copilot ────────────────────────────────────────────────────────────────

def test_is_copilot_inline_comment_user():
    assert is_copilot({"login": "Copilot"}) is True


def test_is_copilot_bot_user():
    assert is_copilot({"login": "copilot-pull-request-reviewer[bot]"}) is True


def test_is_copilot_rejects_human():
    assert is_copilot({"login": "alexeieleusis"}) is False


def test_is_copilot_empty_login():
    assert is_copilot({"login": ""}) is False


def test_is_copilot_missing_login():
    assert is_copilot({}) is False


# ── constants ─────────────────────────────────────────────────────────────────

def test_github_repo_constant():
    assert GITHUB_REPO == "alexeieleusis/lens-flow"


def test_repo_dir_exists():
    assert REPO_DIR.exists()


def test_scripts_dir_is_review_stack():
    assert SCRIPTS_DIR.name == "review_stack"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ~/scripts/review_stack && python -m pytest test_review_stack.py -v -k "Runner or is_copilot or constant"
```

Expected: multiple FAILED / ImportError — `Runner` and `is_copilot` not defined yet.

- [ ] **Step 3: Implement `utils.py`**

```python
#!/usr/bin/env python3
import json
import subprocess
import sys
from pathlib import Path

GITHUB_REPO = "alexeieleusis/lens-flow"
REPO_DIR    = Path("/home/alexeieleusis/second_ssd/development/lensflow/eslint-lensflow-plugin")
SCRIPTS_DIR = Path(__file__).resolve().parent


class Runner:
    def __init__(self, dry_run: bool = False, verbose: bool = False):
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
            return subprocess.CompletedProcess(cmd, 0, stdout="[]", stderr="")
        result = subprocess.run(
            cmd, cwd=cwd or REPO_DIR, capture_output=capture, text=True,
        )
        if check and result.returncode != 0 and not capture:
            print(result.stderr, file=sys.stderr)
            sys.exit(result.returncode)
        return result

    def git(self, *args: str, capture: bool = False, check: bool = True) -> subprocess.CompletedProcess:
        return self.run(["git", *args], capture=capture, check=check)

    def gh(self, *args: str, capture: bool = False, check: bool = True) -> subprocess.CompletedProcess:
        return self.run(["gh", *args], capture=capture, check=check)


def is_copilot(user: dict) -> bool:
    return user.get("login", "").lower().startswith("copilot")


def load_prs(runner: Runner, start: int, end: int) -> list[dict]:
    result = runner.gh(
        "pr", "list",
        "--state", "open",
        "--limit", "400",
        "--json", "number,headRefName",
        "--repo", GITHUB_REPO,
        capture=True,
    )
    if runner.dry_run:
        return [{"number": start, "headRefName": "rule/dry-run"}]
    all_prs: list[dict] = json.loads(result.stdout) if result.stdout.strip() else []
    return sorted(
        [pr for pr in all_prs if start <= pr["number"] <= end],
        key=lambda pr: pr["number"],
    )


def paginate_gh_api(runner: Runner, endpoint: str) -> list[dict]:
    """Fetch all pages from a GitHub API endpoint (100 items per page)."""
    if runner.dry_run:
        return []
    items: list[dict] = []
    page = 1
    while True:
        result = runner.gh(
            "api", f"{endpoint}?per_page=100&page={page}",
            capture=True, check=False,
        )
        if result.returncode != 0 or not result.stdout.strip():
            break
        page_items: list[dict] = json.loads(result.stdout)
        if not page_items:
            break
        items.extend(page_items)
        if len(page_items) < 100:
            break
        page += 1
    return items
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ~/scripts/review_stack && python -m pytest test_review_stack.py -v -k "Runner or is_copilot or constant"
```

Expected: all PASSED.

- [ ] **Step 5: Commit**

```bash
git -C ~/scripts add review_stack/utils.py review_stack/test_review_stack.py
git -C ~/scripts commit -m "feat: implement utils.py with Runner, is_copilot, load_prs, paginate_gh_api"
```

---

## Task 3: `gather.py` — Phase 1

**Files:**
- Modify: `~/scripts/review_stack/gather.py`
- Modify: `~/scripts/review_stack/test_review_stack.py`

- [ ] **Step 1: Write failing tests for `fetch_pr_comments`**

Append to `test_review_stack.py`:

```python
import json
from unittest.mock import patch, MagicMock
from gather import fetch_pr_comments


# ── fetch_pr_comments ─────────────────────────────────────────────────────────

def _make_review(body: str, login: str = "Copilot") -> dict:
    return {"body": body, "user": {"login": login}}


def _make_comment(body: str, path: str, line: int | None, diff_hunk: str, login: str = "Copilot") -> dict:
    return {"body": body, "path": path, "line": line, "diff_hunk": diff_hunk, "user": {"login": login}}


def test_fetch_pr_comments_extracts_copilot_summary():
    with patch("gather.paginate_gh_api") as mock_api:
        mock_api.side_effect = [
            [_make_review("Copilot reviewed 3 files"), _make_review("human comment", "alexeieleusis")],
            [],
        ]
        r = Runner(dry_run=False)
        result = fetch_pr_comments(r, 42, "rule/foo")
    assert result["summary"] == "Copilot reviewed 3 files"
    assert result["pr"] == 42
    assert result["branch"] == "rule/foo"


def test_fetch_pr_comments_extracts_inline_comments():
    with patch("gather.paginate_gh_api") as mock_api:
        mock_api.side_effect = [
            [],
            [
                _make_comment("Use readonly here", "src/rules/foo.ts", 10, "@@ -8,3 @@\n+ const x = 1"),
                _make_comment("Human reply", "src/rules/foo.ts", 10, "", login="alexeieleusis"),
            ],
        ]
        r = Runner(dry_run=False)
        result = fetch_pr_comments(r, 42, "rule/foo")
    assert len(result["comments"]) == 1
    assert result["comments"][0]["file"] == "src/rules/foo.ts"
    assert result["comments"][0]["line"] == 10
    assert result["comments"][0]["body"] == "Use readonly here"
    assert "@@ -8,3 @@" in result["comments"][0]["diff_hunk"]


def test_fetch_pr_comments_empty_when_no_copilot():
    with patch("gather.paginate_gh_api") as mock_api:
        mock_api.side_effect = [
            [_make_review("something", "alexeieleusis")],
            [_make_comment("human", "f.ts", 1, "", login="alexeieleusis")],
        ]
        r = Runner(dry_run=False)
        result = fetch_pr_comments(r, 99, "rule/bar")
    assert result["summary"] == ""
    assert result["comments"] == []
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ~/scripts/review_stack && python -m pytest test_review_stack.py -v -k "fetch_pr_comments"
```

Expected: FAILED — `fetch_pr_comments` not importable.

- [ ] **Step 3: Implement `gather.py`**

```python
#!/usr/bin/env python3
"""
gather — Phase 1: fetch all Copilot review comments from PRs 2-178.

Usage:
  python ~/scripts/review_stack gather [--start 2] [--end 178] [--dry-run] [--verbose]
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from utils import Runner, SCRIPTS_DIR, GITHUB_REPO, load_prs, paginate_gh_api, is_copilot

DATA_DIR = SCRIPTS_DIR / "data"


def fetch_pr_comments(runner: Runner, pr_number: int, branch: str) -> dict:
    reviews = paginate_gh_api(runner, f"repos/{GITHUB_REPO}/pulls/{pr_number}/reviews")
    summary = next(
        (r["body"] for r in reviews if is_copilot(r.get("user", {}))),
        "",
    )

    raw_comments = paginate_gh_api(runner, f"repos/{GITHUB_REPO}/pulls/{pr_number}/comments")
    comments = [
        {
            "file": c["path"],
            "line": c.get("line"),
            "body": c["body"],
            "diff_hunk": c.get("diff_hunk", ""),
        }
        for c in raw_comments
        if is_copilot(c.get("user", {}))
    ]

    return {
        "pr": pr_number,
        "branch": branch,
        "summary": summary,
        "comments": comments,
    }


def main() -> None:
    p = argparse.ArgumentParser(
        description="Gather Copilot review comments from GitHub PRs"
    )
    p.add_argument("--start", type=int, default=2, metavar="N",
                   help="First PR number to fetch (default: 2)")
    p.add_argument("--end", type=int, default=178, metavar="N",
                   help="Last PR number to fetch, inclusive (default: 178)")
    p.add_argument("--dry-run", action="store_true",
                   help="Print actions without executing them")
    p.add_argument("--verbose", action="store_true",
                   help="Show full commands")
    args = p.parse_args()

    runner = Runner(dry_run=args.dry_run, verbose=args.verbose)
    prs = load_prs(runner, args.start, args.end)

    if not prs:
        print(f"No open PRs in range [{args.start}, {args.end}].")
        return

    print(f"Found {len(prs)} PRs. Gathering Copilot comments...")
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    output_path = DATA_DIR / "comments.json"

    total = len(prs)
    written = 0

    with output_path.open("w", encoding="utf-8") as f:
        for idx, pr in enumerate(prs):
            pr_number = pr["number"]
            branch = pr["headRefName"]
            print(f"[{idx+1}/{total}] PR #{pr_number}  {branch}")

            record = fetch_pr_comments(runner, pr_number, branch)
            comment_count = len(record["comments"])

            if comment_count == 0 and not record["summary"]:
                print("  no Copilot comments — skipping")
                continue

            print(f"  {comment_count} inline comment(s)")
            f.write(json.dumps(record) + "\n")
            written += 1

    print(f"\nDone. Wrote {written} PR record(s) to {output_path}")
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ~/scripts/review_stack && python -m pytest test_review_stack.py -v -k "fetch_pr_comments"
```

Expected: all PASSED.

- [ ] **Step 5: Verify dry-run works end-to-end**

```bash
python ~/scripts/review_stack gather --dry-run --verbose --start 2 --end 5
```

Expected: prints PR list command, reports 1 dry-run PR, writes nothing real (or writes a record with empty comments).

- [ ] **Step 6: Commit**

```bash
git -C ~/scripts add review_stack/gather.py review_stack/test_review_stack.py
git -C ~/scripts commit -m "feat: implement gather.py — Phase 1 Copilot comment scraper"
```

---

## Task 4: `consolidate.py` — Phase 2

**Files:**
- Modify: `~/scripts/review_stack/consolidate.py`
- Modify: `~/scripts/review_stack/test_review_stack.py`

- [ ] **Step 1: Write failing tests for batch grouping and progress tracking**

Append to `test_review_stack.py`:

```python
from consolidate import load_progress, save_progress, make_batches


# ── consolidate helpers ───────────────────────────────────────────────────────

def test_load_progress_returns_empty_set_when_no_file(tmp_path, monkeypatch):
    import consolidate
    monkeypatch.setattr(consolidate, "PROGRESS_PATH", tmp_path / "progress.json")
    assert load_progress() == set()


def test_save_and_load_progress_roundtrips(tmp_path, monkeypatch):
    import consolidate
    monkeypatch.setattr(consolidate, "PROGRESS_PATH", tmp_path / "progress.json")
    save_progress({1, 5, 42})
    assert load_progress() == {1, 5, 42}


def test_make_batches_splits_evenly():
    records = [{"pr": i} for i in range(10)]
    batches = make_batches(records, 5)
    assert len(batches) == 2
    assert len(batches[0]) == 5
    assert len(batches[1]) == 5


def test_make_batches_handles_remainder():
    records = [{"pr": i} for i in range(7)]
    batches = make_batches(records, 3)
    assert len(batches) == 3
    assert len(batches[2]) == 1


def test_make_batches_single_batch_when_smaller_than_size():
    records = [{"pr": i} for i in range(3)]
    batches = make_batches(records, 10)
    assert len(batches) == 1
    assert len(batches[0]) == 3
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ~/scripts/review_stack && python -m pytest test_review_stack.py -v -k "consolidate or progress or batches"
```

Expected: FAILED — `load_progress`, `save_progress`, `make_batches` not importable.

- [ ] **Step 3: Implement `consolidate.py`**

```python
#!/usr/bin/env python3
"""
consolidate — Phase 2: fold Copilot comments into a feedback guide via opencode.

Usage:
  python ~/scripts/review_stack consolidate [--batch-size 10] [--resume] [--dry-run] [--verbose]
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from utils import Runner, SCRIPTS_DIR

DATA_DIR      = SCRIPTS_DIR / "data"
FEEDBACK_PATH = DATA_DIR / "feedback.md"
PROGRESS_PATH = DATA_DIR / "consolidate_progress.json"

_FOLD_INSTRUCTION = """\
You are building a code review guide from Copilot review comments on an ESLint plugin project.
Below is the current feedback document (may be empty on the first call), followed by a new batch
of Copilot comments.

Merge the new comments into the feedback document following these rules:
- Organise by category (e.g. "Type Safety", "Import Dependencies", "AST Traversal Patterns")
- Each category: a prose explanation (the WHY), then a bullet checklist of "check that X" items (the WHAT)
- Generalise repeated patterns into principles — do not list the same issue twice
- Add new categories when needed; merge comments into existing ones where they fit
- Write the complete updated document to: data/feedback.md

Current feedback.md:
{current}

New Copilot comments (batch {batch_num}/{total_batches}):
{comments}
"""

_POLISH_INSTRUCTION = """\
Polish the code review guide in data/feedback.md:
- Remove any duplicate checklist items
- Reorder categories by importance (most commonly violated patterns first)
- Tighten the prose (remove filler, keep the WHY clear)
- Ensure every category has both prose and a checklist
- Write the final result back to data/feedback.md
"""


def load_progress() -> set[int]:
    if PROGRESS_PATH.exists():
        return set(json.loads(PROGRESS_PATH.read_text(encoding="utf-8")))
    return set()


def save_progress(done: set[int]) -> None:
    PROGRESS_PATH.write_text(
        json.dumps(sorted(done), indent=2), encoding="utf-8"
    )


def make_batches(records: list[dict], batch_size: int) -> list[list[dict]]:
    return [records[i:i + batch_size] for i in range(0, len(records), batch_size)]


def _format_batch(batch: list[dict]) -> str:
    lines: list[str] = []
    for record in batch:
        lines.append(f"### PR #{record['pr']} ({record['branch']})")
        if record.get("summary"):
            lines.append(f"Summary: {record['summary']}")
        for c in record.get("comments", []):
            lines.append(f"File: {c['file']}  line: {c['line']}")
            lines.append(f"Comment: {c['body']}")
            if c.get("diff_hunk"):
                lines.append(f"Code context:\n{c['diff_hunk']}")
            lines.append("")
    return "\n".join(lines)


def _invoke_opencode(prompt: str, runner: Runner) -> None:
    if runner.dry_run:
        print("  [dry-run] would invoke opencode")
        return
    subprocess.run(["opencode", "run", prompt], cwd=SCRIPTS_DIR, check=False)


def main() -> None:
    p = argparse.ArgumentParser(
        description="Consolidate Copilot feedback into a review guide via opencode"
    )
    p.add_argument("--batch-size", type=int, default=10, metavar="N",
                   help="PRs per opencode invocation (default: 10)")
    p.add_argument("--resume", action="store_true",
                   help="Skip PRs already processed (tracked in consolidate_progress.json)")
    p.add_argument("--dry-run", action="store_true",
                   help="Print actions without executing them")
    p.add_argument("--verbose", action="store_true",
                   help="Show full commands")
    args = p.parse_args()

    runner = Runner(dry_run=args.dry_run, verbose=args.verbose)

    comments_path = DATA_DIR / "comments.json"
    if not comments_path.exists():
        print("Error: data/comments.json not found. Run 'gather' first.")
        sys.exit(1)

    records = [
        json.loads(line)
        for line in comments_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]

    done = load_progress() if args.resume else set()
    pending = [r for r in records if r["pr"] not in done]

    if not pending:
        print("All PRs already processed. Delete data/consolidate_progress.json to restart.")
        return

    print(f"Consolidating {len(pending)} PR(s) in batches of {args.batch_size}...")
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    batches = make_batches(pending, args.batch_size)
    total_batches = len(batches)

    for batch_num, batch in enumerate(batches, 1):
        print(f"  batch {batch_num}/{total_batches} ({len(batch)} PRs)...")

        current = (
            FEEDBACK_PATH.read_text(encoding="utf-8")
            if FEEDBACK_PATH.exists()
            else "(empty — this is the first batch)"
        )

        prompt = _FOLD_INSTRUCTION.format(
            current=current,
            batch_num=batch_num,
            total_batches=total_batches,
            comments=_format_batch(batch),
        )

        _invoke_opencode(prompt, runner)

        for record in batch:
            done.add(record["pr"])
        save_progress(done)

    print("  final polish pass...")
    _invoke_opencode(_POLISH_INSTRUCTION, runner)

    print(f"\nDone. Feedback guide written to {FEEDBACK_PATH}")
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ~/scripts/review_stack && python -m pytest test_review_stack.py -v -k "consolidate or progress or batches"
```

Expected: all PASSED.

- [ ] **Step 5: Verify dry-run works end-to-end**

Create a minimal `data/comments.json` for testing:

```bash
echo '{"pr":2,"branch":"rule/dry","summary":"Copilot reviewed 1 file","comments":[]}' \
  > ~/scripts/review_stack/data/comments.json
python ~/scripts/review_stack consolidate --dry-run --verbose
```

Expected: prints batch progress, prints `[dry-run] would invoke opencode` twice (fold + polish), does not create `feedback.md`.

- [ ] **Step 6: Commit**

```bash
git -C ~/scripts add review_stack/consolidate.py review_stack/test_review_stack.py
git -C ~/scripts commit -m "feat: implement consolidate.py — Phase 2 feedback distillation via opencode"
```

---

## Task 5: `review.py` — Phase 3

**Files:**
- Modify: `~/scripts/review_stack/review.py`
- Modify: `~/scripts/review_stack/test_review_stack.py`

- [ ] **Step 1: Write failing tests for `review_exists` and `review_path_for`**

Append to `test_review_stack.py`:

```python
from review import review_exists, review_path_for


# ── review helpers ────────────────────────────────────────────────────────────

def test_review_path_for_formats_correctly():
    path = review_path_for(179)
    assert path.name == "pr-179.md"
    assert path.parent.name == "reviews"


def test_review_exists_false_when_no_file(tmp_path, monkeypatch):
    import review
    monkeypatch.setattr(review, "REVIEWS_DIR", tmp_path)
    assert review_exists(179) is False


def test_review_exists_true_when_file_present(tmp_path, monkeypatch):
    import review
    monkeypatch.setattr(review, "REVIEWS_DIR", tmp_path)
    (tmp_path / "pr-179.md").write_text("review content")
    assert review_exists(179) is True
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ~/scripts/review_stack && python -m pytest test_review_stack.py -v -k "review_exists or review_path"
```

Expected: FAILED — `review_exists`, `review_path_for` not importable.

- [ ] **Step 3: Implement `review.py`**

```python
#!/usr/bin/env python3
"""
review — Phase 3: review PRs 179-299 using the distilled feedback guide via opencode.

Usage:
  python ~/scripts/review_stack review [--start 179] [--end 299] [--resume] [--dry-run] [--verbose]
"""
import argparse
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from utils import Runner, SCRIPTS_DIR, REPO_DIR, GITHUB_REPO, load_prs

DATA_DIR     = SCRIPTS_DIR / "data"
REVIEWS_DIR  = DATA_DIR / "reviews"
FEEDBACK_PATH = DATA_DIR / "feedback.md"

_REVIEW_INSTRUCTION = """\
You are performing a code review for an ESLint plugin project.
Use the review rubric in data/feedback.md to evaluate the following git diff.

For each checklist item in the rubric that is VIOLATED, report:
  - File and line number
  - The checklist item violated
  - A concrete suggested fix (show the corrected code if possible)

Be concise. Only report actual violations — skip items that pass.
Write your complete review to: data/reviews/{filename}

Git diff:
{diff}
"""


def review_path_for(pr_number: int) -> Path:
    return REVIEWS_DIR / f"pr-{pr_number}.md"


def review_exists(pr_number: int) -> bool:
    return review_path_for(pr_number).exists()


def _get_diff(runner: Runner) -> str:
    result = runner.git("diff", "origin/main...HEAD", capture=True, check=False)
    return result.stdout


def _invoke_opencode(prompt: str, runner: Runner) -> None:
    if runner.dry_run:
        print("  [dry-run] would invoke opencode")
        return
    subprocess.run(["opencode", "run", prompt], cwd=SCRIPTS_DIR, check=False)


def _post_comment(pr_number: int, review_path: Path, runner: Runner) -> None:
    runner.gh(
        "pr", "comment", str(pr_number),
        "--body-file", str(review_path),
        "--repo", GITHUB_REPO,
        check=False,
    )


def main() -> None:
    p = argparse.ArgumentParser(
        description="Review PRs using the distilled Copilot feedback guide"
    )
    p.add_argument("--start", type=int, default=179, metavar="N",
                   help="First PR number to review (default: 179)")
    p.add_argument("--end", type=int, default=299, metavar="N",
                   help="Last PR number to review, inclusive (default: 299)")
    p.add_argument("--resume", action="store_true",
                   help="Skip PRs that already have a review file in data/reviews/")
    p.add_argument("--dry-run", action="store_true",
                   help="Print actions without executing them")
    p.add_argument("--verbose", action="store_true",
                   help="Show full commands")
    args = p.parse_args()

    runner = Runner(dry_run=args.dry_run, verbose=args.verbose)

    if not FEEDBACK_PATH.exists() and not args.dry_run:
        print("Error: data/feedback.md not found. Run 'consolidate' first.")
        sys.exit(1)

    prs = load_prs(runner, args.start, args.end)
    if not prs:
        print(f"No open PRs in range [{args.start}, {args.end}].")
        return

    REVIEWS_DIR.mkdir(parents=True, exist_ok=True)
    total = len(prs)

    original_branch = runner.git("branch", "--show-current", capture=True).stdout.strip()

    for idx, pr in enumerate(prs):
        pr_number = pr["number"]
        branch    = pr["headRefName"]

        print(f"\n{'='*60}")
        print(f"[{idx+1}/{total}] PR #{pr_number}  {branch}")
        print(f"{'='*60}")

        if args.resume and review_exists(pr_number):
            print("  review file exists — skipping")
            continue

        live = runner.git("branch", "--show-current", capture=True).stdout.strip()
        if live != branch:
            runner.git("checkout", branch)

        diff = _get_diff(runner)
        if not diff.strip() and not args.dry_run:
            print("  empty diff — skipping")
            runner.git("checkout", original_branch or "main")
            continue

        filename = f"pr-{pr_number}.md"
        prompt = _REVIEW_INSTRUCTION.format(
            filename=filename,
            diff=diff or "(dry-run: no real diff)",
        )

        print("  invoking opencode for review...")
        _invoke_opencode(prompt, runner)

        review_path = review_path_for(pr_number)
        if review_path.exists():
            print("  posting review as GitHub PR comment...")
            _post_comment(pr_number, review_path, runner)
            print(f"  saved to {review_path}")
        elif not args.dry_run:
            print(f"  [!] opencode did not write {review_path} — skipping comment post")

    if original_branch:
        live = runner.git("branch", "--show-current", capture=True).stdout.strip()
        if live != original_branch:
            runner.git("checkout", original_branch)

    print(f"\n{'='*60}")
    print(f"Done — processed {total} PR(s).")
    print(f"{'='*60}")
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ~/scripts/review_stack && python -m pytest test_review_stack.py -v -k "review_exists or review_path"
```

Expected: all PASSED.

- [ ] **Step 5: Verify dry-run works end-to-end**

```bash
python ~/scripts/review_stack review --dry-run --verbose --start 179 --end 182
```

Expected: prints PR list, shows `[dry-run] would invoke opencode` per PR, no files written.

- [ ] **Step 6: Commit**

```bash
git -C ~/scripts add review_stack/review.py review_stack/test_review_stack.py
git -C ~/scripts commit -m "feat: implement review.py — Phase 3 opencode-driven PR reviewer"
```

---

## Task 6: Full test suite run and final integration verification

**Files:**
- No new files — verification only.

- [ ] **Step 1: Run the full test suite**

```bash
cd ~/scripts/review_stack && python -m pytest test_review_stack.py -v
```

Expected: all tests PASSED with no warnings about missing imports.

- [ ] **Step 2: Verify the help output covers all subcommands**

```bash
python ~/scripts/review_stack --help
```

Expected output contains `gather`, `consolidate`, `review`.

- [ ] **Step 3: Verify each subcommand's `--help`**

```bash
python ~/scripts/review_stack gather --help
python ~/scripts/review_stack consolidate --help
python ~/scripts/review_stack review --help
```

Expected: each shows its own flags (`--start`, `--end`, `--batch-size`, `--resume`, `--dry-run`, `--verbose`).

- [ ] **Step 4: Full dry-run pipeline**

```bash
# Step 1 — gather (writes nothing in dry-run)
python ~/scripts/review_stack gather --dry-run --verbose --start 2 --end 3

# Step 2 — consolidate needs comments.json; use the test file from Task 4
python ~/scripts/review_stack consolidate --dry-run --verbose

# Step 3 — review
python ~/scripts/review_stack review --dry-run --verbose --start 179 --end 181
```

Expected: each subcommand completes without error, printing `[dry-run]` markers for opencode calls.

- [ ] **Step 5: Final commit (only if any tweaks were made during verification)**

```bash
git -C ~/scripts add review_stack/
git -C ~/scripts commit -m "chore: review_stack full dry-run pipeline verified"
```
