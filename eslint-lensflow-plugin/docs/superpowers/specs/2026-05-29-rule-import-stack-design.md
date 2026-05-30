# Rule Import Stack — Design

**Date:** 2026-05-29
**Goal:** Incrementally import 297 ESLint rules from `vibe-types/eslint-plugin` into `eslint-lensflow-plugin` using a stacked PR workflow, automated by a Python script, with Copilot code review and opencode for addressing comments.

---

## Context

- **Source repo:** `/home/alexeieleusis/development/vibe-types/eslint-plugin` — 297 TypeScript rules, 10 shared utils, vitest tests
- **Target repo:** `/home/alexeieleusis/second_ssd/development/lensflow/eslint-lensflow-plugin` — freshly converted to TypeScript, same toolchain as source
- **GitHub remote:** `alexeieleusis/lens-flow`
- **Tools:** `git`, `git-spice` (restack only), `gh` (PRs, reviews, comments), `opencode` (addressing review comments)

---

## Work List

Fixed, ordered, derived from source repo at script startup:

| # | Branch | Contents |
|---|--------|----------|
| 1 | `utils` | All `src/utils/*.ts` except `rule-creator.ts` (already in target) |
| 2–298 | `rule/<rule-name>` | One rule + its test file, alphabetical by filename |
| 299 | `register-rules` | Regenerated `src/index.ts` registering all 297 rules |

**Branch naming:** `utils`, `rule/no-any-parameter`, `rule/no-any-array-parameter`, …, `register-rules`

**File copies are verbatim** — no path changes needed. Both repos share the same `src/rules/` / `src/utils/` / `tests/rules/` layout and the same relative import paths. The only file that differs between repos is `src/utils/rule-creator.ts` (URL points to this repo), which is already in place and not overwritten.

`src/index.ts` is **not modified** on rule branches — tests import rules directly, so registration doesn't affect correctness. It is only written on the final `register-rules` branch.

---

## Script

**Location:** `eslint-lensflow-plugin/stack.py`

**Config block** (top of file, not a separate config file):
```python
SOURCE_REPO = "/home/alexeieleusis/development/vibe-types/eslint-plugin"
TARGET_REPO = "/home/alexeieleusis/second_ssd/development/lensflow/eslint-lensflow-plugin"
GITHUB_REPO = "alexeieleusis/lens-flow"
MAIN_BRANCH = "main"
```

**CLI:**
```
./stack.py --phase branch|review|restack|merge
           [--limit N]    # process at most N items this run
           [--dry-run]    # print actions, execute nothing
           [--verbose]    # show full command output
```

**State derivation** — no state file. On every run the script calls:
- `git branch -r` → which branches exist
- `gh pr list --state all --json number,headRefName,state,reviews,reviewThreads` → PR and review state

It diffs against the full work list to determine what's pending and where to resume.

**Status summary** printed on every run before any work:
```
Phase: branch
Total items: 299 (1 utils + 297 rules + 1 register-rules)
Branched:    12  (utils + 11 rules)
PRs open:    12
Reviewed:    0
Merged:      0
Next:        rule/no-any-array-parameter
```

---

## Phase: branch

For each item in the work list that does not yet have a remote branch:

```
1. git checkout -b <branch> <prev-branch>
2. copy files from source repo (verbatim)
3. [register-rules only] regenerate src/index.ts from all files in src/rules/
4a. npm test && npm run typecheck
4b. ON FAILURE → opencode run "<error> — fix the build failure in <branch>"
4c. retry once; ON SECOND FAILURE → print error, leave branch, exit
5. git add -A && git commit -m "feat: add rule <rule-name>"
6. git push -u origin <branch>
7. git-spice btr
8. gh pr create --base <prev-branch> --title "feat: add rule <rule-name>" --body "..."
9. gh pr edit <number> --add-reviewer copilot
```

`<prev-branch>` for the first item is `main`; for all subsequent items it is the immediately preceding item in the work list.

On failure after the opencode retry: the branch is left in place for inspection. Re-running `--phase branch` later skips completed branches and retries from the failed one.

---

## Phase: review

For each PR in work-list order:

```
1. gh pr view <number> --json reviewThreads
2. filter to threads where isResolved == false
3. if none → skip
4. git checkout <branch>
5. for each unresolved thread:
   a. build prompt:
      "You are working in the eslint-lensflow-plugin project.
       In file <path>, the reviewer left this comment: '<body>'.
       Please address it."
   b. opencode run "$PROMPT"
   c. gh api graphql — resolveReviewThread(threadId: <id>)
6. git add -A && git commit -m "review: address copilot comments"
7. git push
```

One `opencode run` per comment thread — smaller tasks yield better results and are faster with a local model.

**No second review is requested.** After pushing, all threads are resolved and the PR is considered ready to merge.

**Skipping logic:** if all threads are already resolved (or there are no threads), the PR is skipped entirely. Running `--phase review` again is always safe.

---

## Phase: restack

Run after all comments are addressed, before merging:

```
1. git checkout utils
2. git-spice upstack restack
3. git push --force-with-lease origin <each remaining branch>
```

`--force-with-lease` is the safe variant of force-push — it fails if the remote has commits not seen locally, preventing accidental overwrites.

---

## Phase: merge

Merges PRs bottom-to-top (utils → rules alphabetically → register-rules). After each squash merge, the next branch is rebased onto `main` to drop the now-merged commits.

```
For each PR in order:
  1. gh pr view <number> --json state,mergeable,statusCheckRollup
  2. if state == MERGED → skip
  3. if not mergeable or CI failing → print warning, skip
  4. gh pr merge <number> --squash --delete-branch
  5. git fetch origin && git pull origin main
  6. if not the last PR:
     a. git checkout <next-branch>
     b. git rebase main
     c. gh pr edit <next-number> --base main
     d. git push --force-with-lease origin <next-branch>
```

The script does not wait for CI between merges — it skips unready PRs. Re-running `--phase merge` is safe and will pick up where it left off.

---

## Error Handling Summary

| Situation | Behaviour |
|-----------|-----------|
| Build/test failure on branch | opencode retry once; on second failure: leave branch, exit |
| opencode produces no change | commit empty (git reports nothing to commit) — move on |
| PR already exists for branch | skip PR creation, continue |
| Review comment already resolved | skip that thread |
| PR not mergeable / CI failing | print warning, skip, re-run later |
| Network / gh CLI error | Python exception with traceback; re-run is safe |
