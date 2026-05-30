import subprocess
import sys
from pathlib import Path
import pytest
from unittest.mock import patch, call

SCRIPT = Path(__file__).parent / "stack.py"

sys.path.insert(0, str(Path(__file__).parent))
from stack import Runner


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
