import subprocess
import sys
from pathlib import Path
import pytest
from unittest.mock import patch, call

SCRIPT = Path(__file__).parent / "stack.py"

sys.path.insert(0, str(Path(__file__).parent))
from stack import Runner, build_work_list, WorkItem


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


# ── work_list tests ───────────────────────────────────────────────────────────

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
