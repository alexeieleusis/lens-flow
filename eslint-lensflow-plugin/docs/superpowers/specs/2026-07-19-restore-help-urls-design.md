# Restore help URLs in eslint-lensflow-plugin rules

## Problem

Every rule in `src/rules/*.ts` should link its lint message to a knowledge-base
markdown file via the `knowledgeUrl()` helper (`src/utils/knowledge-url.ts`),
following the pattern in `src/rules/consistent-constructor-strategy.ts`:

```ts
const URL = knowledgeUrl("catalog/T26-refinement-types.md");
// ...
messages: {
  inconsistent: "... See: {{url}}",
},
// ...
context.report({
  node,
  messageId: "inconsistent",
  data: { ..., url: URL },
});
```

During independent, per-rule code review passes, many rule files ended up
with this link either removed entirely or implemented in a non-standard way.
A survey of all 282 files in `src/rules/` found:

- **~38 files**: already fully compliant.
- **222 files**: have a raw `https://raw.githubusercontent.com/...` URL
  hardcoded directly in the message string, not using `knowledgeUrl()`.
- **5 files**: use `knowledgeUrl()` but splice the URL into the message via
  string concatenation (`"...See: " + URL`) instead of the `{{url}}` /
  `data.url` template style.
- **2 files** (`no-collect-then-sync-iterate.ts`,
  `no-collect-then-transform.ts`): import a shared `ASYNC_ITERATION_URL`
  constant from `src/utils/async-iteration.ts` (a raw hardcoded URL on a
  different, older commit than the canonical one in `knowledge-url.ts`).
- **15 files**: have no URL at all currently. The correct knowledge-file path
  for every one of these was recovered from the `delete_lastRule` git branch,
  which still has the original (pre-review) version of each file.

Every rule references exactly one knowledge markdown file — no rule needed
splitting across multiple `.md` sources, and every non-compliant file has a
resolvable target path (no unresolvable stragglers).

**Goal:** normalize all 282 files to the same standard —
`knowledgeUrl()` constant, `{{url}}` in every relevant message, `url` in
every matching `context.report()` call's `data`.

## Approach

A single Python script, `~/scripts/restore_help_urls.py`, run from the
`eslint-lensflow-plugin` repo, following the conventions already established
by `~/scripts/rewrite_rule_branches.py` and `~/scripts/fix_stack.py`
(a `Runner` class wrapping `git`/`gh`/subprocess calls, `--dry-run` and
`--verbose` flags, `REPO_DIR` pointed at this repo).

It uses `opencode run "<prompt>"` (already installed at
`~/.opencode/bin/opencode`, already used by `fix_stack.py`) to perform the
actual code edits, since the transformation is structural (add an import, add
a constant, adjust message text, adjust `report()` call `data` objects) rather
than a pure text substitution.

### Phase 1: build the map (`--build-map`)

For each of the 282 files in `src/rules/`, determine compliance:

> Compliant = uses `knowledgeUrl()` **and** every message that should link to
> docs ends with the literal `{{url}}` **and** every `context.report()` call
> for such a message has `url: <constName>` in its `data` object.

For every non-compliant file, resolve the target knowledge markdown path:

1. If a raw `raw.githubusercontent.com/.../plugin/skills/typescript/<path>`
   URL appears anywhere in the file, extract `<path>`.
2. Else if the file imports a shared `*_URL` constant from another file under
   `src/utils/` (not `knowledge-url.ts`), resolve that constant's value and
   extract `<path>` the same way. Record `cleanup_util: <path to that utils
   file>` on the map entry.
3. Else (no URL anywhere currently) run
   `git show delete_lastRule:eslint-lensflow-plugin/src/rules/<name>.ts`
   and extract `<path>` from the raw URL found there.

Write the result to `<scratchpad>/url-map.json`: a list of
`{rule, knowledge_path, source, cleanup_util?}`, `source` being one of
`raw-url`, `shared-util-const`, `concat-style`, `missing-recovered`.
Compliant files are simply omitted from the list.

Because compliance is recomputed from the current file content each time,
re-running `--build-map` after a partial `--apply` run naturally produces a
shorter list — this is the resumability mechanism; no separate progress-state
file is needed.

### Phase 2: apply (`--apply`, default)

Preconditions: git working tree must be clean (abort with a clear message
otherwise — do not stash or discard anything automatically).

For each entry in `url-map.json`, in file order:

1. **Prompt opencode** with a tightly-scoped instruction for exactly one
   file: bring `src/rules/<rule>.ts` in line with the pattern in
   `src/rules/consistent-constructor-strategy.ts` —
   - Import `knowledgeUrl` from `../utils/knowledge-url.js` if not already
     imported.
   - Declare (or reuse, if one already exists) a module-level constant set to
     `knowledgeUrl("<knowledge_path>")`. Default name `URL` unless the file
     already uses the global `URL` (e.g. `new URL(...)`), in which case pick
     an alternative like `DOCS_URL`.
   - Remove any raw hardcoded URL string and/or any import of a shared `*_URL`
     constant from another utils file, replacing both with the local
     `knowledgeUrl()` constant.
   - Every message in `messages: {...}` that links to docs must end with
     `See: {{url}}` (normalize concatenation-style or differently-worded
     "See" text into this form; don't duplicate it).
   - Every `context.report(...)` call for such a messageId must include
     `url: <constName>` in its `data` object, merged with any existing data
     fields.
   - Change nothing else in the file (no unrelated refactors).
2. Run `opencode run "<prompt>"` with cwd set to the repo directory.
3. **Verify:** `npm run typecheck` and
   `npx vitest run tests/rules/<rule>.test.ts` (confirmed 1:1 file naming
   between `src/rules/*.ts` and `tests/rules/*.test.ts` for all 282 rules).
4. **On success:** `git add` the changed file(s) and commit
   `fix: restore help URL in <rule-name>`.
5. **On failure:** append the typecheck/test error output to a follow-up
   opencode prompt and retry, up to 3 attempts total for this file. If still
   failing after 3 attempts: `git restore` the file back to its pre-attempt
   state (keep the tree clean for the next file), append the rule name and
   last error to `needs-manual-review.txt`, and continue to the next file —
   a single stubborn file must never abort the whole run.

After the loop: if both `no-collect-then-sync-iterate.ts` and
`no-collect-then-transform.ts` were successfully converted (no rule file
still references `ASYNC_ITERATION_URL`), remove that now-dead export from
`src/utils/async-iteration.ts` in one final commit
(`fix: remove unused ASYNC_ITERATION_URL constant`).

Print a final summary: files fixed, files skipped (already compliant), files
failed (with the `needs-manual-review.txt` path).

### `--dry-run`

Prints the prompt that would be sent to opencode for each file (and the
verify/commit steps that would follow) without actually invoking opencode,
running verification, or committing. Useful for sanity-checking the map and
prompt wording against a handful of files before committing to the full run.

## Error handling

- Dirty working tree at start → abort immediately, no automatic
  stash/discard.
- opencode edit fails verification → bounded retry (3 attempts) with error
  context fed back in, then revert-and-skip, never abort the whole run.
- A file with no resolvable knowledge path (didn't occur in this survey, but
  should the map ever fail to resolve one) → omit it from `url-map.json` with
  a warning printed during `--build-map`, so it's visible before `--apply`
  ever runs.

## Testing / verification

The script's correctness is exercised by its own per-file verify step
(typecheck + that rule's vitest file) during real usage. Before the full run,
use `--dry-run` against a small slice (e.g. `--start` / `--end` flags mirroring
`rewrite_rule_branches.py`) to eyeball generated prompts, then run `--apply`
on that same small slice for real before letting it loose on all 244
non-compliant files.
