import importlib.util
import sys
from pathlib import Path

import pytest

SCRIPT = Path(__file__).parent / "update-vibe-types-commit.py"

spec = importlib.util.spec_from_file_location("update_vibe_types_commit", SCRIPT)
update_vibe_types_commit = importlib.util.module_from_spec(spec)
sys.modules["update_vibe_types_commit"] = update_vibe_types_commit
spec.loader.exec_module(update_vibe_types_commit)

from update_vibe_types_commit import Change, knowledge_key, match_rules, TYPESCRIPT_SEGMENT


# ── knowledge_key ──────────────────────────────────────────────────────────────

def test_knowledge_key_strips_typescript_prefix():
    path = f"{TYPESCRIPT_SEGMENT}/catalog/no-any.md"
    assert knowledge_key(path) == "catalog/no-any.md"


def test_knowledge_key_leaves_unprefixed_path_unchanged():
    assert knowledge_key("catalog/no-any.md") == "catalog/no-any.md"


# ── diff_knowledge_files parsing ────────────────────────────────────────────────

def test_diff_knowledge_files_parses_added_modified_deleted(tmp_path, monkeypatch):
    calls = {}

    def fake_git(*args, cwd, capture=True, check=True):
        calls["args"] = args
        return (
            "A\tplugin/skills/typescript/catalog/new-doc.md\n"
            "M\tplugin/skills/typescript/catalog/existing-doc.md\n"
            "D\tplugin/skills/typescript/usecases/old-doc.md\n"
        )

    monkeypatch.setattr(update_vibe_types_commit, "git", fake_git)
    changes = update_vibe_types_commit.diff_knowledge_files(tmp_path, "old", "new")

    assert changes == [
        Change(status="added", old_path="plugin/skills/typescript/catalog/new-doc.md",
               new_path="plugin/skills/typescript/catalog/new-doc.md"),
        Change(status="modified", old_path="plugin/skills/typescript/catalog/existing-doc.md",
               new_path="plugin/skills/typescript/catalog/existing-doc.md"),
        Change(status="deleted", old_path="plugin/skills/typescript/usecases/old-doc.md",
               new_path="plugin/skills/typescript/usecases/old-doc.md"),
    ]


def test_diff_knowledge_files_parses_rename(tmp_path, monkeypatch):
    def fake_git(*args, cwd, capture=True, check=True):
        return "R100\tplugin/skills/typescript/catalog/old-name.md\tplugin/skills/typescript/catalog/new-name.md\n"

    monkeypatch.setattr(update_vibe_types_commit, "git", fake_git)
    changes = update_vibe_types_commit.diff_knowledge_files(tmp_path, "old", "new")

    assert changes == [
        Change(status="renamed",
               old_path="plugin/skills/typescript/catalog/old-name.md",
               new_path="plugin/skills/typescript/catalog/new-name.md"),
    ]


def test_diff_knowledge_files_skips_blank_lines(tmp_path, monkeypatch):
    def fake_git(*args, cwd, capture=True, check=True):
        return "\nM\tplugin/skills/typescript/catalog/existing-doc.md\n\n"

    monkeypatch.setattr(update_vibe_types_commit, "git", fake_git)
    changes = update_vibe_types_commit.diff_knowledge_files(tmp_path, "old", "new")

    assert len(changes) == 1
    assert changes[0].status == "modified"


# ── build_rule_index / match_rules ──────────────────────────────────────────────

@pytest.fixture
def synthetic_rules_dir(tmp_path, monkeypatch):
    rules_dir = tmp_path / "src" / "rules"
    rules_dir.mkdir(parents=True)
    (rules_dir / "no-any-parameter.ts").write_text(
        'knowledgeUrl("catalog/no-any.md")'
    )
    (rules_dir / "no-unused-vars.ts").write_text(
        'knowledgeUrl("catalog/no-unused.md", "Section")'
    )
    (rules_dir / "no-knowledge-url.ts").write_text("// no citation here")
    monkeypatch.setattr(update_vibe_types_commit, "RULES_DIR", rules_dir)
    return rules_dir


def test_build_rule_index_maps_knowledge_path_to_rule(synthetic_rules_dir):
    index = update_vibe_types_commit.build_rule_index()
    assert index["catalog/no-any.md"] == [synthetic_rules_dir / "no-any-parameter.ts"]
    assert index["catalog/no-unused.md"] == [synthetic_rules_dir / "no-unused-vars.ts"]


def test_build_rule_index_ignores_rules_without_citation(synthetic_rules_dir):
    index = update_vibe_types_commit.build_rule_index()
    cited_rules = {rf.stem for rules in index.values() for rf in rules}
    assert "no-knowledge-url" not in cited_rules


def test_match_rules_matches_modified_change(synthetic_rules_dir):
    rule_index = update_vibe_types_commit.build_rule_index()
    change = Change(
        status="modified",
        old_path=f"{TYPESCRIPT_SEGMENT}/catalog/no-any.md",
        new_path=f"{TYPESCRIPT_SEGMENT}/catalog/no-any.md",
    )
    matched = match_rules([change], rule_index)
    assert matched == [(synthetic_rules_dir / "no-any-parameter.ts", change)]


def test_match_rules_matches_rename_by_either_path(synthetic_rules_dir):
    rule_index = update_vibe_types_commit.build_rule_index()
    change = Change(
        status="renamed",
        old_path=f"{TYPESCRIPT_SEGMENT}/catalog/no-any.md",
        new_path=f"{TYPESCRIPT_SEGMENT}/catalog/no-any-renamed.md",
    )
    matched = match_rules([change], rule_index)
    assert matched == [(synthetic_rules_dir / "no-any-parameter.ts", change)]


def test_match_rules_returns_empty_for_unreferenced_change(synthetic_rules_dir):
    rule_index = update_vibe_types_commit.build_rule_index()
    change = Change(
        status="added",
        old_path=f"{TYPESCRIPT_SEGMENT}/catalog/unrelated.md",
        new_path=f"{TYPESCRIPT_SEGMENT}/catalog/unrelated.md",
    )
    assert match_rules([change], rule_index) == []
