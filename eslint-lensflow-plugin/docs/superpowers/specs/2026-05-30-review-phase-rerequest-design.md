# Design: Review phase — lookahead re-request for Copilot

**Date:** 2026-05-30

## Problem

PRs were created too fast; Copilot failed to review most PRs beyond #33, leaving the
error comment "Copilot encountered an error and was unable to review this pull request."
Addressing review comments for one PR takes 10–20 minutes, which is enough time for
Copilot to complete a new review if kicked off at the start of that window.

## Solution

At the beginning of each iteration in `phase_review`, re-request a Copilot review for
the candidate that is 32 slots ahead in the `candidates` list. By the time the script
reaches that candidate, Copilot will have had 10–20 minutes to complete the review.

Merging remains in `--phase merge` and is not touched.

## Changes

### New function — `rerequest_review(pr_number, runner)`

Calls `gh pr edit <pr_number> --add-reviewer copilot --repo GITHUB_REPO`.
Uses `capture=True` so failures do not abort the script.

### Modified loop in `phase_review`

```
for idx, item in enumerate(candidates):
    # lookahead re-request
    lookahead_idx = idx + 32
    if lookahead_idx < len(candidates):
        lookahead_pr = state[candidates[lookahead_idx].branch].pr_number
        if lookahead_pr is not None:
            rerequest_review(lookahead_pr, runner)

    # existing: checkout, fetch threads, opencode, commit, push
    ...
```

No other behaviour changes.

## Out of scope

- Merge logic (stays in `--phase merge`)
- Detecting / filtering the Copilot error comment body
- Retry logic if re-request itself fails
