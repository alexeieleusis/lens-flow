# Design: Review phase — lookahead re-request for Copilot

**Date:** 2026-05-30

## Problem

PRs were created too fast; Copilot failed to review most PRs beyond #33, leaving the
error comment "Copilot encountered an error and was unable to review this pull request."
Addressing review comments for one PR takes 10–20 minutes, which is enough time for
Copilot to complete a new review if kicked off at the start of that window.

## Solution

At the beginning of each iteration in `phase_review`, re-request a Copilot review for
the candidate that is `LOOKAHEAD_OFFSET` slots ahead in the `candidates` list. By the
time the script reaches that candidate, Copilot will have had 10–20 minutes to complete
the review.

**Derivation of `LOOKAHEAD_OFFSET = 32`:**
Each `phase_review` iteration runs `git checkout`, a GraphQL fetch, `opencode run`
(typically minutes), `git commit`, and `git push`. A conservative estimate is ~40s per
iteration. Copilot needs 10–20 minutes to complete a review once triggered. So the
offset is `ceil(10 min / 40s) ≈ 15`, rounded up to 32 to provide a generous buffer
for slower iterations and Copilot queuing delays. This is intentionally conservative:
a smaller offset risks re-requesting a PR before Copilot finishes, which wastes Copilot
review capacity. The value should be revisited once actual iteration timings are measured.
Optionally configurable via CLI flag in the future.

Merging remains in `--phase merge` and is not touched.

## Changes

### New function — `rerequest_review(pr_number, runner)`

Calls `gh pr edit <pr_number> --add-reviewer copilot --repo GITHUB_REPO`.
Uses `capture=True` so failures do not abort the script.

### Modified loop in `phase_review`

```
LOOKAHEAD_OFFSET = 32  # ~10min Copilot review / ~40s per iteration, rounded up w/ buffer

rerequested = set()  # deduplicate within a single run

for idx, item in enumerate(candidates):
    # lookahead re-request (deduplicated)
    lookahead_idx = idx + LOOKAHEAD_OFFSET
    if lookahead_idx < len(candidates):
        lookahead_pr = state[candidates[lookahead_idx].branch].pr_number
        if lookahead_pr is not None and lookahead_pr not in rerequested:
            rerequested.add(lookahead_pr)
            rerequest_review(lookahead_pr, runner)

    # existing: checkout, fetch threads, opencode, commit, push
    ...
```

No other behaviour changes.

### Deduplication and restart behaviour

The `rerequested` set prevents duplicate `gh pr edit` calls for the same PR number
within a single `phase_review` run. This avoids noisy GitHub notifications and
reduces API rate-limit risk when the lookahead window overlaps (e.g., consecutive
iterations pointing at the same `idx + 32` candidate).

**Across restarts:** The set is in-memory only and does not persist. If the script
is interrupted and re-run, a PR that was already re-requested in the previous run
may receive a second `gh pr edit --add-reviewer copilot` call. This is acceptable:
GitHub simply re-adds Copilot as a reviewer, which is idempotent. The `capture=True`
flag ensures a failure (e.g., rate limit 403) won't abort the script. If this proves
problematic, persistence can be added later via a simple `.re requested` marker file
or by checking the PR's existing reviewers before calling `gh pr edit`.

## Out of scope

- Merge logic (stays in `--phase merge`)
- Detecting / filtering the Copilot error comment body
- Retry logic if re-request itself fails
