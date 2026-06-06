# review_stack — Design Spec

**Date:** 2026-06-06
**Status:** Approved

## Problem

A stack of PRs (2–178) has received Copilot code reviews. Copilot credits are exhausted, so PRs 179–299 cannot receive new reviews. The goal is to harvest the knowledge from the existing Copilot reviews and use it to drive opencode-based reviews on the remaining PRs.

## Solution Overview

A Python package at `~/scripts/review_stack/` with three phases:

1. **gather** — scrape all Copilot comments from PRs 2–178 via the GitHub API
2. **consolidate** — fold those comments into a distilled feedback document via opencode
3. **review** — use the feedback document as a rubric to review PRs 179–299 via opencode

## Package Structure

```
~/scripts/review_stack/
  __main__.py         ← entry point, subcommand dispatcher
  utils.py            ← Runner class, shared helpers, constants
  gather.py           ← Phase 1: scrape Copilot comments
  consolidate.py      ← Phase 2: fold comments into feedback.md via opencode
  review.py           ← Phase 3: review PRs using feedback.md via opencode
  data/
    comments.json     ← output of gather (newline-delimited JSON, one record per PR)
    feedback.md       ← output of consolidate (categorized guide + checklists)
    consolidate_progress.json  ← tracks which PRs have been folded (for --resume)
    reviews/
      pr-NNN.md       ← one review file per PR (output of review phase)
```

## Invocation

```
python ~/scripts/review_stack gather      [--start 2]   [--end 178] [--dry-run] [--verbose]
python ~/scripts/review_stack consolidate [--batch-size 10] [--resume] [--dry-run] [--verbose]
python ~/scripts/review_stack review      [--start 179] [--end 299] [--resume] [--dry-run] [--verbose]
```

`__main__.py` is a thin dispatcher that calls `gather.main()`, `consolidate.main()`, or `review.main()` based on `sys.argv[1]`. Prints usage when called with no arguments or `--help`.

## Phase 1 — `gather.py`

**Input:** GitHub API (PRs 2–178)
**Output:** `data/comments.json`

For each PR in range:

1. Fetch review objects via `GET /repos/{repo}/pulls/{pr}/reviews` — filter to users whose `login` starts with `copilot` (case-insensitive). Capture the summary `body`.
2. Fetch inline comments via `GET /repos/{repo}/pulls/{pr}/comments` — same filter. Capture `path`, `line`, `body`, `diff_hunk`. Handle pagination (100 items/page).
3. Write one newline-delimited JSON record per PR:

```json
{
  "pr": 42,
  "branch": "rule/no-foo",
  "summary": "Copilot reviewed 5 files and generated 3 comments.",
  "comments": [
    {
      "file": "src/rules/no-foo.ts",
      "line": 17,
      "body": "This cast is unsafe because...",
      "diff_hunk": "@@ -14,6 +14,8 @@\n+  const x = node as any;"
    }
  ]
}
```

PRs with no Copilot comments are skipped silently. Supports `--dry-run` and `--verbose`.

**Copilot bot usernames observed:**
- `Copilot` — inline review comments
- `copilot-pull-request-reviewer[bot]` — review summary objects

Filter: `user.login.lower().startswith("copilot")`

## Phase 2 — `consolidate.py`

**Input:** `data/comments.json`
**Output:** `data/feedback.md`

Uses a fold loop with opencode to incrementally build the feedback document:

1. Load all PR records, group into batches of N (default 10, configurable via `--batch-size`).
2. For each batch, invoke opencode with:
   - Current contents of `feedback.md` (empty on first iteration)
   - The batch of comments (file, body, diff_hunk)
   - Fixed instruction: *"Merge these Copilot review comments into the feedback document. Add new categories if needed, generalise repeated patterns into principles, keep the format: category heading → prose explanation → bullet checklist."*
3. opencode overwrites `feedback.md` with the updated version.
4. After all batches, one final polish pass: invoke opencode with the full `feedback.md` asking it to deduplicate, reorder by importance, and tighten the prose.

Progress is tracked in `data/consolidate_progress.json` (list of processed PR numbers). `--resume` skips already-processed PRs.

**Output format (`feedback.md`):**
Each category section contains:
- Prose explanation (the *why*)
- Bullet checklist of concrete "check that X" items (the *what*)

## Phase 3 — `review.py`

**Input:** `data/feedback.md`, GitHub API (PRs 179–299)
**Output:** `data/reviews/pr-NNN.md` + GitHub PR comment

For each PR in range:

1. Checkout the branch via `git checkout {branch}` (not `gh pr co` — avoids fast-forward failures on rebased branches).
2. Get the diff via `git diff origin/main...HEAD`.
3. Invoke opencode with the full `feedback.md` as rubric + the diff. Instruction: *"Review this PR diff against the feedback rubric. For each checklist item that is violated, report: the file, the line, the violated rule, and a suggested fix. Be concise."*
4. Save opencode's output to `data/reviews/pr-NNN.md`.
5. Post as a GitHub PR comment: `gh pr comment {pr} --body-file data/reviews/pr-NNN.md --repo alexeieleusis/lens-flow`.
6. Checkout back to the previous branch before moving to the next PR.

`--resume` skips PRs that already have a file in `data/reviews/`. Supports `--dry-run` and `--verbose`.

## Shared — `utils.py`

- `Runner` class — same contract as `fix_stack.py`: `run()`, `git()`, `gh()`, `dry_run`, `verbose`
- `GITHUB_REPO = "alexeieleusis/lens-flow"`
- `REPO_DIR` — path to the eslint-lensflow-plugin repo
- `SCRIPTS_DIR` — path to `~/scripts/review_stack/`
- `load_prs(runner, start, end)` — fetch and sort open PRs in range
- `paginate_gh_api(runner, endpoint)` — auto-paginates GitHub API responses (100 items/page)

## Data Flow

```
GitHub API (PRs 2-178)
        │
        ▼
   gather.py
        │
        ▼
data/comments.json
        │
        ▼
 consolidate.py  ←→  opencode (fold loop)
        │
        ▼
 data/feedback.md
        │
        ▼
   review.py  ←→  opencode (one invocation per PR)
        │
        ├──▶ data/reviews/pr-NNN.md
        └──▶ GitHub PR comment
```

## Constraints

- opencode is used (not Claude CLI) for Phases 2 and 3 — local LLM, no quota concerns
- All comments are harvested (resolved and unresolved) — the goal is to capture Copilot's full knowledge
- `--dry-run` and `--verbose` on all subcommands
- `--resume` on consolidate and review to recover from interruptions
- Bot filter: `user.login.lower().startswith("copilot")`
