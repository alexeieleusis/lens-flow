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

# ── Work list ─────────────────────────────────────────────────────────────────

UTILS_SKIP = {"rule-creator.ts"}   # already in target with correct URL

def build_work_list() -> list[WorkItem]:
    rules_dir = SOURCE_REPO / "src" / "rules"
    rule_files = sorted((f.stem for f in rules_dir.iterdir() if f.suffix == ".ts"))

    items: list[WorkItem] = []

    # 1. utils
    items.append(WorkItem(branch="utils", kind="utils"))

    # 2. rules (alphabetical)
    for rule_name in rule_files:
        items.append(WorkItem(
            branch=f"rule/{rule_name}",
            kind="rule",
            rule_name=rule_name,
        ))

    # 3. register-rules
    items.append(WorkItem(branch="register-rules", kind="register-rules"))

    return items

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
