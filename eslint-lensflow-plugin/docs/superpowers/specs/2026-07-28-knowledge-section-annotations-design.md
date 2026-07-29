# Add knowledge-section annotations to rule help URLs

## Problem

Every rule in `src/rules/*.ts` links its lint message to a knowledge-base
markdown file via `knowledgeUrl(path)` (`src/utils/knowledge-url.ts`), e.g.:

```ts
const URL = knowledgeUrl("catalog/T47-gradual-typing.md");
```

This was normalized across all 282 rule files by a prior project
(`~/scripts/restore_help_urls.py`, see
`docs/superpowers/specs/2026-07-19-restore-help-urls-design.md`).

The knowledge files themselves
(`~/second_ssd/development/vibe-types/plugin/skills/typescript/{catalog,usecases}/*.md`)
are long — many contain a dozen or more `##`/`###` subsections (numbered
sections, "Example A/B/C", "Pattern A"/"Antipattern A" repeated under
different parents, plain prose subsections with no numbering at all;
structure is not consistent from file to file). There are 48 unique
knowledge files referenced across the 282 rules (up to 11 rules sharing one
file), and nothing in the code currently records *which part* of a shared
file a given rule's rationale actually came from. A developer (or an LLM)
reading a lint message and following the link has to read the entire file
to find the relevant example.

**Goal:** for every rule, determine — using `opencode` to read both the rule
file and its knowledge file — the specific heading/example/antipattern that
best explains the rule's rationale, and thread that into the existing
`knowledgeUrl()` call so it shows up in the lint message a developer or
LLM sees.

## Decisions

These were settled through discussion before writing this spec:

1. **The URL string itself does not change.** `knowledgeUrl`'s base
   (`raw.githubusercontent.com/...`) stays as-is. A `#fragment` on a raw-text
   URL wouldn't do anything in a browser (no HTML, no anchors), so the
   section is carried as human-readable text, not a navigable link target.
2. **The section is shown in the lint message**, not just as a code
   comment — it's meant to be read by a human or an LLM agent who will open
   the doc and act on that pointer.
3. **Section identifier = verbatim heading text**, with a parent-heading
   prefix (`"Parent > Child"`) only when the heading text alone isn't unique
   within the file (e.g. "Antipattern A" appears under two different `##`
   parents in some usecases files). No invented numbering scheme is imposed
   on files that don't already have one.
4. **Fallback allowed:** if no Example/Pattern/Antipattern subsection fits,
   opencode may point to the closest relevant general/conceptual heading
   instead. Every rule should end up with *some* section — this is not a
   "flag for manual review" case.
5. **Batching: one opencode invocation per rule** (282 total), not batched
   per shared knowledge file. Simpler prompt/response shape, isolated
   failure blast radius, consistent with the per-rule retry/verify/commit
   loop from the prior script.
6. **`knowledgeUrl(path, section)` returns one combined string.** This means
   the only line that changes in each of the 282 rule files is the
   `knowledgeUrl(...)` call itself — no changes to `messages: {...}`
   templates or `context.report()` data objects, since they already say
   `{{url}}` / `url: <const>`.
7. **Script lives at `~/scripts/`, in Python**, mirroring
   `restore_help_urls.py` and `rewrite_rule_branches.py` (`Runner` class,
   `--build-map`/`--apply`, `--dry-run`, `--start`/`--end`, retry-then-log
   pattern) — not inside this repo's `scripts/` directory (which currently
   only holds a plain-text-substitution Node script with no opencode/verify
   loop).

## `knowledge-url.ts` change

```ts
const COMMIT = "7891def9e1b66bebd95a393b42f3401eba697cd5";
const BASE = `https://raw.githubusercontent.com/jpablo/vibe-types/${COMMIT}/plugin/skills/typescript/`;

export function knowledgeUrl(path: string, section: string): string {
  return `${BASE}${path} (see: "${section}")`;
}
```

Every call site gets a second string argument, e.g.:

```ts
const URL = knowledgeUrl(
  "catalog/T47-gradual-typing.md",
  "Antipattern A — any to bypass type errors",
);
```

The constant's name is **not** standardized by this project — it stays
whatever it already is per file (`URL`, `RULE_URL`, `RULE_DOCS_URL`,
`DOCS_URL`, `DOC_URL`, `KNOWLEDGE_URL`, `DISCRIMINANT_DOC_URL` all occur
today). The script locates the `knowledgeUrl(` call itself rather than
assuming a constant name.

## Script: `~/scripts/add_knowledge_sections.py`

Two-phase CLI, same shape as `restore_help_urls.py`.

### Phase 1 — `--build-map`

Scan `src/rules/*.ts`. A file is **pending** if it contains a
`knowledgeUrl(` call with exactly one argument (a single quoted string,
no comma at the top level of the argument list). A file is **done** if its
`knowledgeUrl(` call already has two arguments. Because this recomputes from
current file content every time, re-running `--build-map` after a partial
`--apply` run naturally produces a shorter list — this is the resumability
mechanism; no separate progress-state file is needed.

For each pending file, extract the knowledge path from its existing
`knowledgeUrl("<path>")` call. Write `{rule, knowledge_path}` entries to
`url-sections-map.json`.

Every rule currently has exactly one `knowledgeUrl(` call (verified: no
`src/rules/*.ts` file has more than one occurrence), so there is no
multi-call disambiguation to handle.

### Phase 2 — `--apply` (default retry budget: 3)

Preconditions: clean git working tree (abort otherwise, no auto-stash);
baseline `npm run typecheck` must already pass (abort otherwise, same as
`restore_help_urls.py`).

For each entry, in file order:

1. **Build the opencode prompt** for exactly one file:
   - Read `src/rules/<rule>.ts` (its messages, description, and check logic)
     and the full knowledge file at
     `~/second_ssd/development/vibe-types/plugin/skills/typescript/<knowledge_path>`
     (absolute path, outside the repo `opencode` is invoked in — opencode can
     read arbitrary absolute paths on disk).
   - Instruct it to:
     a. Identify the single `##`/`###` heading in the knowledge file whose
        content most directly explains why this rule exists (an Example,
        Pattern, or Antipattern subsection preferred; a general/conceptual
        heading is an acceptable fallback if nothing more specific fits).
     b. Use that heading's exact text as written, including any existing
        number/letter prefix. If that exact text is not unique within the
        file, prefix it with its nearest `##` ancestor heading, joined by
        `" > "`.
     c. Find the existing `knowledgeUrl("<path>")` call in
        `src/rules/<rule>.ts` (whatever its constant is named) and add the
        resolved section string as a second argument, matching the updated
        `knowledgeUrl(path, section)` signature.
     d. Change nothing else in the file.
2. Run `opencode run "<prompt>"` with cwd set to `REPO_DIR`.
3. **Verify:** `npm run typecheck` and
   `npx vitest run tests/rules/<rule>.test.ts`.
4. **On success:** `git add` the file, commit
   `fix: add knowledge section to <rule-name>`.
5. **On failure:** feed the typecheck/test error output back into a
   follow-up opencode prompt and retry, up to 3 attempts total. If still
   failing: `git restore` the file (keep the tree clean for the next file),
   append the rule name and last error to `needs-manual-review.txt`, and
   continue — one stubborn file never aborts the whole run.

Print a final summary: files fixed, files failed (with the
`needs-manual-review.txt` path).

### `--dry-run`

Prints the prompt that would be sent to opencode for each file (and the
verify/commit steps that would follow) without invoking opencode, running
verification, or committing.

### `--start` / `--end`

Alphabetical slicing by rule name, same as `restore_help_urls.py`, for
sanity-checking a handful of files before letting the script loose on all
282.

## Error handling

- Dirty working tree or failing baseline typecheck at start → abort
  immediately with a clear message, no automatic stash/discard.
- opencode edit fails verification → bounded retry (3 attempts, error
  context fed back in each retry) → revert-and-skip, never abort the whole
  run.
- A rule whose `knowledgeUrl(` call can't be found or whose knowledge path
  doesn't resolve to a real file on disk → omitted from the map with a
  warning printed during `--build-map`, visible before `--apply` ever runs.

## Testing / verification

The script's correctness is exercised by its own per-file verify step
(typecheck + that rule's vitest file) during real usage, same as the prior
script. Pure logic (map building/compliance-check, prompt construction,
retry/commit state machine) gets unit tests mirroring
`test_restore_help_urls.py`'s style (plain `pytest`, `capsys`,
dependency-injected callables, no mocking libraries beyond that).

Before a full run: use `--dry-run` against a small `--start`/`--end` slice
to eyeball generated prompts and confirm the section text opencode proposes
actually matches real headings in the target knowledge file, then run
`--apply` on that same slice for real before the full 282-file run.
