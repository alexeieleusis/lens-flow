#!/usr/bin/env python3
"""
rerequest_reviews.py — Re-request Copilot review for open PRs that have no
review comments yet. Waits 5 minutes between each re-request to avoid
overwhelming the review queue.

Usage:
  ./rerequest_reviews.py [--start-pr N] [--dry-run] [--verbose]

Example:
  ./rerequest_reviews.py --start-pr 39
"""

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path
import os

# ── Config ────────────────────────────────────────────────────────────────────

TARGET_REPO  = Path(__file__).resolve().parent
GITHUB_REPO  = "alexeieleusis/lens-flow"
WAIT_REMOVE_ADD  = 1 * 60  # 1 minute between remove and re-add
WAIT_NEXT_PR     = 4 * 60  # 4 minutes after re-add before next PR
COPILOT_ERROR_BODY = "Copilot encountered an error and was unable to review this pull request"

# ── Runner ────────────────────────────────────────────────────────────────────

class Runner:
    def __init__(self, dry_run: bool = False, verbose: bool = False):
        self.dry_run = dry_run
        self.verbose = verbose

    def run(self, cmd: list[str], capture: bool = False) -> subprocess.CompletedProcess:
        if self.verbose or self.dry_run:
            print(f"  $ {' '.join(str(c) for c in cmd)}")
        if self.dry_run:
            return subprocess.CompletedProcess(cmd, 0, stdout="", stderr="")
        result = subprocess.run(
            cmd, cwd=TARGET_REPO, capture_output=capture, text=True,
        )
        if result.returncode != 0 and not capture:
            print(result.stderr, file=sys.stderr)
            sys.exit(result.returncode)
        return result

    def gh(self, *args: str, capture: bool = False) -> subprocess.CompletedProcess:
        return self.run(["gh", *args], capture=capture)

# ── Helpers ───────────────────────────────────────────────────────────────────

def has_real_review(pr_number: int, runner: Runner) -> bool:
    """Returns True if the PR has a real Copilot review (not just an error response)."""
    result = runner.gh(
        "pr", "view", str(pr_number),
        "--json", "reviews",
        "--repo", GITHUB_REPO,
        capture=True,
    )
    if runner.dry_run:
        return False
    if result.returncode != 0 or not result.stdout.strip():
        print(f"  warning: could not fetch PR #{pr_number}: {result.stderr.strip()}")
        return True  # assume reviewed to avoid spamming
    data = json.loads(result.stdout)
    reviews = data.get("reviews", [])
    return any(COPILOT_ERROR_BODY not in r.get("body", "") for r in reviews)


def rerequest_review(pr_number: int, runner: Runner) -> None:
    runner.gh(
        "pr", "edit", str(pr_number),
        "--remove-reviewer", "@copilot",
        "--repo", GITHUB_REPO,
        capture=True,
    )
    print(f"  removed @copilot — waiting 1 min before re-adding…")
    if not runner.dry_run:
        time.sleep(WAIT_REMOVE_ADD)
    runner.gh(
        "pr", "edit", str(pr_number),
        "--add-reviewer", "@copilot",
        "--repo", GITHUB_REPO,
        capture=True,
    )

# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    p = argparse.ArgumentParser(
        description="Re-request Copilot review for open PRs with no review comments"
    )
    p.add_argument("--start-pr", type=int, default=None,
                   help="GitHub PR number to start from (lower-numbered PRs are skipped)")
    p.add_argument("--dry-run", action="store_true",
                   help="Print actions without executing them")
    p.add_argument("--verbose", action="store_true",
                   help="Show full commands")
    args = p.parse_args()

    runner = Runner(dry_run=args.dry_run, verbose=args.verbose)

    result = subprocess.run(
        ["gh", "pr", "list",
         "--state", "open",
         "--limit", "400",
         "--json", "number,headRefName",
         "--repo", GITHUB_REPO],
        cwd=TARGET_REPO, capture_output=True, text=True,
    )
    if result.returncode != 0:
        print(f"Error fetching PRs: {result.stderr}", file=sys.stderr)
        sys.exit(1)

    prs: list[dict] = json.loads(result.stdout) if result.stdout.strip() else []
    prs.sort(key=lambda pr: pr["number"])

    if args.start_pr is not None:
        prs = [pr for pr in prs if pr["number"] >= args.start_pr]

    suffix = f" (from PR #{args.start_pr})" if args.start_pr else ""
    print(f"Found {len(prs)} open PRs to check{suffix}\n")

    rerequested = 0
    for idx, pr in enumerate(prs):
        pr_number = pr["number"]
        branch    = pr["headRefName"]
        print(f"[{idx+1}/{len(prs)}] PR #{pr_number}  {branch}")

        if has_real_review(pr_number, runner):
            print("  already has a real review — skipping")
            continue

        print(f"  no real review (error or missing) — re-requesting Copilot review")
        rerequest_review(pr_number, runner)
        rerequested += 1

        is_last = idx == len(prs) - 1
        if not is_last:
            next_pr = prs[idx + 1]["number"]
            print(f"  waiting 4 min before PR #{next_pr}…")
            if not args.dry_run:
                time.sleep(WAIT_NEXT_PR)

    print(f"\nDone. Re-requested reviews for {rerequested} PR(s).")


if __name__ == "__main__":
    main()
