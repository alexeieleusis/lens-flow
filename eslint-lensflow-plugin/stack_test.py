import subprocess
import sys
from pathlib import Path

SCRIPT = Path(__file__).parent / "stack.py"


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
