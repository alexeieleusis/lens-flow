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
