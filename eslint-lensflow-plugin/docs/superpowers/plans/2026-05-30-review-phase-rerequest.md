# Review-Phase Copilot Re-Request Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Before addressing review comments for PR n, automatically re-request a Copilot review for the candidate 32 slots ahead so it is ready by the time the script reaches it.

**Architecture:** Add a single `rerequest_review` helper in `stack.py` and call it at the top of the `phase_review` loop. No other behaviour changes.

**Tech Stack:** Python 3.12, `gh` CLI, `pytest`

---

### Task 1: Add `rerequest_review` and test it

**Files:**
- Modify: `stack.py` — add function after `resolve_thread` (line 386)
- Modify: `stack_test.py` — add import + test

- [ ] **Step 1: Write the failing test**

Add to `stack_test.py`, after the existing `build_review_prompt` tests:

```python
# ── rerequest_review tests ────────────────────────────────────────────────────

def test_rerequest_review_calls_gh_pr_edit(capsys):
    r = Runner(dry_run=True)
    from stack import rerequest_review
    rerequest_review(42, r)
    out = capsys.readouterr().out
    assert "gh pr edit 42" in out
    assert "copilot" in out
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest stack_test.py::test_rerequest_review_calls_gh_pr_edit -v
```

Expected: `ImportError` or `FAILED` — `rerequest_review` does not exist yet.

- [ ] **Step 3: Add `rerequest_review` to `stack.py`**

Insert after the `resolve_thread` function (after line 392):

```python
def rerequest_review(pr_number: int, runner: Runner) -> None:
    print(f"  re-requesting Copilot review for PR #{pr_number}")
    runner.gh(
        "pr", "edit", str(pr_number),
        "--add-reviewer", "copilot",
        "--repo", GITHUB_REPO,
        capture=True,
    )
```

- [ ] **Step 4: Update the import line in `stack_test.py`**

Change the existing import line (line 12) from:

```python
from stack import Runner, build_work_list, copy_utils, WorkItem, derive_state, ItemState, to_camel_case, generate_index, build_review_prompt, make_rebase_onto_cmd
```

to:

```python
from stack import Runner, build_work_list, copy_utils, WorkItem, derive_state, ItemState, to_camel_case, generate_index, build_review_prompt, make_rebase_onto_cmd, rerequest_review
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pytest stack_test.py::test_rerequest_review_calls_gh_pr_edit -v
```

Expected: `PASSED`

- [ ] **Step 6: Run full test suite to check for regressions**

```bash
pytest stack_test.py -v
```

Expected: all tests `PASSED`

- [ ] **Step 7: Commit**

```bash
git add stack.py stack_test.py
git commit -m "feat: add rerequest_review helper for Copilot re-request"
```

---

### Task 2: Wire `rerequest_review` into `phase_review`

**Files:**
- Modify: `stack.py` — `phase_review` function, inside the `for` loop

- [ ] **Step 1: Write the failing test**

Add to `stack_test.py`:

```python
def test_phase_review_rerequests_lookahead(monkeypatch, capsys):
    """When processing candidate idx=0, it re-requests review for candidate idx=32."""
    import stack as s

    # Build 35 fake candidates so there is a lookahead target at idx=32
    candidates = [
        WorkItem(branch=f"rule/rule-{i:02d}", kind="rule", rule_name=f"rule-{i:02d}")
        for i in range(35)
    ]
    state = {
        c.branch: ItemState(branched=True, pr_number=i + 10, pr_state="OPEN")
        for i, c in enumerate(candidates)
    }

    # Patch gh pr view to return no review threads so the loop skips quickly
    def fake_gh_view(*args, **kwargs):
        import subprocess
        return subprocess.CompletedProcess(args, 0,
            stdout='{"reviewThreads": []}', stderr="")

    monkeypatch.setattr(s.Runner, "gh", lambda self, *a, **kw: fake_gh_view(*a, **kw))

    calls: list[int] = []

    def fake_rerequest(pr_number: int, runner) -> None:
        calls.append(pr_number)

    monkeypatch.setattr(s, "rerequest_review", fake_rerequest)

    runner = s.Runner(dry_run=False)
    s.phase_review(candidates, state, runner, limit=1)

    # candidates[0 + 32] has pr_number = 32 + 10 = 42
    assert 42 in calls
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest stack_test.py::test_phase_review_rerequests_lookahead -v
```

Expected: `FAILED` — `rerequest_review` is never called.

- [ ] **Step 3: Add lookahead call to `phase_review`**

In `stack.py`, inside `phase_review`, at the top of the `for item in candidates` loop (after the `print(f"\n[review]...")`  line), add:

```python
        # Re-request Copilot review for the PR 32 slots ahead
        lookahead_idx = idx + 32
        if lookahead_idx < len(candidates):
            lookahead_pr = state[candidates[lookahead_idx].branch].pr_number
            if lookahead_pr is not None:
                rerequest_review(lookahead_pr, runner)
```

Also change the loop header from:

```python
    for item in candidates:
```

to:

```python
    for idx, item in enumerate(candidates):
```

- [ ] **Step 4: Run the new test to verify it passes**

```bash
pytest stack_test.py::test_phase_review_rerequests_lookahead -v
```

Expected: `PASSED`

- [ ] **Step 5: Run full test suite**

```bash
pytest stack_test.py -v
```

Expected: all tests `PASSED`

- [ ] **Step 6: Smoke-test with dry-run**

```bash
python stack.py --phase review --dry-run --limit 1
```

Expected: output includes a line like `re-requesting Copilot review for PR #<N>` before the first item's review work.

- [ ] **Step 7: Commit**

```bash
git add stack.py stack_test.py
git commit -m "feat: re-request Copilot review for PR n+32 before addressing PR n"
```
