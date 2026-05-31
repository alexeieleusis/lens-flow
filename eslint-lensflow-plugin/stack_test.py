import subprocess
import sys
from pathlib import Path
import pytest
import json
from unittest.mock import patch, call

SCRIPT = Path(__file__).parent / "stack.py"

sys.path.insert(0, str(Path(__file__).parent))
import stack
from stack import Runner, build_work_list, copy_utils, WorkItem, derive_state, ItemState, to_camel_case, generate_index, build_review_prompt, make_rebase_onto_cmd, rerequest_review


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

@pytest.fixture
def synthetic_source_repo(tmp_path, monkeypatch):
    src_rules = tmp_path / "src" / "rules"
    src_rules.mkdir(parents=True)
    src_utils = tmp_path / "src" / "utils"
    src_utils.mkdir(parents=True)
    for name in ["alpha-rule", "beta-rule", "gamma-rule"]:
        (src_rules / f"{name}.ts").write_text(f"// {name}")
    (src_utils / "ast-helpers.ts").write_text("// ast-helpers")
    (src_utils / "rule-creator.ts").write_text("// rule-creator")
    monkeypatch.setattr(stack, "SOURCE_REPO", tmp_path)
    return tmp_path


def test_work_list_starts_with_utils(synthetic_source_repo):
    items = build_work_list()
    assert items[0].kind == "utils"
    assert items[0].branch == "utils"


def test_work_list_ends_with_register_rules(synthetic_source_repo):
    items = build_work_list()
    assert items[-1].kind == "register-rules"
    assert items[-1].branch == "register-rules"


def test_work_list_rules_are_alphabetical(synthetic_source_repo):
    items = build_work_list()
    rules = [i for i in items if i.kind == "rule"]
    names = [i.rule_name for i in rules]
    assert names == sorted(names)


def test_work_list_rules_total(synthetic_source_repo):
    items = build_work_list()
    rules = [i for i in items if i.kind == "rule"]
    assert len(rules) == 3  # alpha-rule, beta-rule, gamma-rule


def test_work_list_total_length(synthetic_source_repo):
    items = build_work_list()
    assert len(items) == 5  # 1 utils + 3 rules + 1 register-rules


def test_work_list_rule_branch_naming(synthetic_source_repo):
    items = build_work_list()
    first_rule = next(i for i in items if i.kind == "rule")
    assert first_rule.branch == f"rule/{first_rule.rule_name}"


def test_work_list_excludes_rule_creator_from_utils(tmp_path, monkeypatch):
    src = tmp_path / "src"
    dst = tmp_path / "dst"
    src_utils = src / "src" / "utils"
    src_utils.mkdir(parents=True)
    (src_utils / "ast-helpers.ts").write_text("// ast-helpers")
    (src_utils / "rule-creator.ts").write_text("// rule-creator")
    monkeypatch.setattr(stack, "SOURCE_REPO", src)
    monkeypatch.setattr(stack, "TARGET_REPO", dst)
    copy_utils(Runner(dry_run=False))
    dst_utils = dst / "src" / "utils"
    assert (dst_utils / "ast-helpers.ts").exists()
    assert not (dst_utils / "rule-creator.ts").exists()


# ── derive_state tests ────────────────────────────────────────────────────────

FAKE_BRANCHES = """
  origin/main
  origin/utils
  origin/rule/consistent-constructor-strategy
"""

FAKE_PRS = json.dumps([
    {"number": 1, "headRefName": "utils",   "state": "OPEN"},
    {"number": 2, "headRefName": "rule/consistent-constructor-strategy", "state": "MERGED"},
])


def test_derive_state_detects_branched():
    items = [
        WorkItem(branch="utils", kind="utils"),
        WorkItem(branch="rule/consistent-constructor-strategy", kind="rule",
                 rule_name="consistent-constructor-strategy"),
        WorkItem(branch="rule/no-any-parameter", kind="rule",
                 rule_name="no-any-parameter"),
    ]
    state = derive_state(items, FAKE_BRANCHES, FAKE_PRS)
    assert state["utils"].branched is True
    assert state["rule/consistent-constructor-strategy"].branched is True
    assert state["rule/no-any-parameter"].branched is False


def test_derive_state_pr_numbers():
    items = [
        WorkItem(branch="utils", kind="utils"),
        WorkItem(branch="rule/consistent-constructor-strategy", kind="rule",
                 rule_name="consistent-constructor-strategy"),
    ]
    state = derive_state(items, FAKE_BRANCHES, FAKE_PRS)
    assert state["utils"].pr_number == 1
    assert state["rule/consistent-constructor-strategy"].pr_number == 2


def test_derive_state_pr_states():
    items = [
        WorkItem(branch="utils", kind="utils"),
        WorkItem(branch="rule/consistent-constructor-strategy", kind="rule",
                 rule_name="consistent-constructor-strategy"),
    ]
    state = derive_state(items, FAKE_BRANCHES, FAKE_PRS)
    assert state["utils"].pr_state == "OPEN"
    assert state["rule/consistent-constructor-strategy"].pr_state == "MERGED"


def test_derive_state_no_pr_for_unbranched():
    items = [
        WorkItem(branch="rule/no-any-parameter", kind="rule", rule_name="no-any-parameter"),
    ]
    state = derive_state(items, FAKE_BRANCHES, FAKE_PRS)
    assert state["rule/no-any-parameter"].pr_number is None
    assert state["rule/no-any-parameter"].pr_state is None


# ── index generator tests ─────────────────────────────────────────────────────

def test_to_camel_case_basic():
    assert to_camel_case("no-any-parameter") == "noAnyParameter"


def test_to_camel_case_single_word():
    assert to_camel_case("utils") == "utils"


def test_to_camel_case_uc_suffix():
    assert to_camel_case("no-abstract-class-overkill-uc14") == "noAbstractClassOverkillUc14"


def test_generate_index_imports():
    src = generate_index(["no-any-parameter", "no-any-array-return"])
    assert 'import noAnyParameter from "./rules/no-any-parameter"' in src
    assert 'import noAnyArrayReturn from "./rules/no-any-array-return"' in src


def test_generate_index_rules_object():
    src = generate_index(["no-any-parameter"])
    assert '"no-any-parameter": noAnyParameter' in src


def test_generate_index_exports_default():
    src = generate_index(["no-any-parameter"])
    assert "export default plugin" in src


def test_generate_index_empty_rules():
    src = generate_index([])
    assert "rules: {}" in src


# ── build_review_prompt tests ─────────────────────────────────────────────────

def test_build_review_prompt_includes_file_and_comment():
    prompt = build_review_prompt(
        rule_name="no-any-parameter",
        file_path="src/rules/no-any-parameter.ts",
        line=42,
        comment_body="This could be simplified using a utility function.",
    )
    assert "no-any-parameter" in prompt
    assert "src/rules/no-any-parameter.ts" in prompt
    assert "This could be simplified" in prompt
    assert "eslint-lensflow-plugin" in prompt


def test_build_review_prompt_no_line():
    prompt = build_review_prompt(
        rule_name="no-any-parameter",
        file_path="src/rules/no-any-parameter.ts",
        line=None,
        comment_body="General comment.",
    )
    assert "General comment." in prompt
    assert "no-any-parameter" in prompt


# ── rerequest_review tests ────────────────────────────────────────────────────

def test_rerequest_review_calls_gh_pr_edit(capsys):
    r = Runner(dry_run=True)
    from stack import rerequest_review
    rerequest_review(42, r)
    out = capsys.readouterr().out
    assert "gh pr edit 42" in out
    assert "copilot" in out


def test_phase_review_rerequests_lookahead(monkeypatch, capsys):
    """When processing candidate idx=0, it re-requests review for candidate idx=32."""
    import stack as s

    # Build 35 fake candidates so there is a lookahead target at idx=32
    candidates = [
        WorkItem(branch=f"rule/rule-{i:02d}", kind="rule", rule_name=f"rule-{i:02d}")
        for i in range(35)
    ]
    state = {
        c.branch: ItemState(branched=True, pr_number=i + 10, pr_state="OPEN")
        for i, c in enumerate(candidates)
    }

    # Patch gh to return no review threads so the loop skips quickly
    def fake_gh(self, *args, **kwargs):
        import subprocess
        return subprocess.CompletedProcess(list(args), 0,
            stdout='{"reviewThreads": []}', stderr="")

    monkeypatch.setattr(s.Runner, "gh", fake_gh)

    calls: list[int] = []

    def fake_rerequest(pr_number: int, runner) -> None:
        calls.append(pr_number)

    monkeypatch.setattr(s, "rerequest_review", fake_rerequest)

    runner = s.Runner(dry_run=False)
    s.phase_review(candidates, state, runner, limit=1)

    # candidates[0 + 32] has pr_number = 32 + 10 = 42
    assert 42 in calls


# ── make_rebase_onto_cmd tests ────────────────────────────────────────────────

def test_make_rebase_onto_cmd():
    cmd = make_rebase_onto_cmd(tip_sha="abc123", next_branch="rule/no-any-parameter")
    assert cmd == ["git", "rebase", "--onto", "main", "abc123", "rule/no-any-parameter"]
