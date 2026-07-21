# GitHub Actions CI for eslint-lensflow-plugin

## Context

The repo (`alexeieleusis/lens-flow`) currently has no `.github/` workflows. It holds one
package, `eslint-lensflow-plugin` (an ESLint plugin), with a `.gitignore` comment hinting
at a future Java/SonarQube plugin. This design scopes CI to `eslint-lensflow-plugin` only —
YAGNI on multi-plugin workflow structure until a second plugin actually exists and we know
what its tooling looks like.

`sonar-project.properties` already references `oxlint-report.xml` and `coverage/lcov.info`,
so oxlint and coverage were anticipated but never wired up.

## Goals

- PRs to `main` and pushes to `main` run: clean compilation (typecheck + build), linting
  (ESLint + oxlint), formatting check (Prettier), and tests with enforced coverage
  thresholds.
- Reproducible installs (`npm ci` against a committed lockfile).
- Standard hygiene: minimal permissions, concurrency cancellation, dependency updates via
  Dependabot, CI status visible in the README.

## Non-goals

- Multi-plugin / matrix workflow structure (revisit when plugin #2 lands).
- Node version matrix (single latest-LTS version only).
- Publishing/release automation.
- Branch protection rules (a GitHub repo-settings change, not a file in this repo — call
  out as a manual follow-up).

## Workflow: `.github/workflows/ci.yml`

**Triggers:** `pull_request` targeting `main`, `push` to `main`.

**Concurrency:**

```yaml
concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

**Permissions:** `contents: read` at the workflow level (least privilege; no job needs
more).

**Job `ci`:** runs on `ubuntu-latest`, `defaults.run.working-directory:
eslint-lensflow-plugin`, Node 24.x via `actions/setup-node@v4` (current LTS as of 2026-07;
satisfies `engines: >=24` in package.json) with `cache: npm` and
`cache-dependency-path: eslint-lensflow-plugin/package-lock.json`.

Steps, in fail-fast order (cheapest checks first, expensive test suite last):

1. `actions/checkout@v4`
2. `actions/setup-node@v4` (Node 24.x, npm cache)
3. `npm ci`
4. `npm run typecheck` — `tsc --noEmit`
5. `npm run build` — `tsc -p tsconfig.build.json` (verifies actual emit/declarations, not
   just type-checking)
6. `npm run lint` — existing ESLint step; dogfoods the plugin's own custom rules against
   its own source
7. `npm run lint:oxlint` — new; fast general-purpose JS/TS correctness linting
   (oxlint cannot run this repo's custom ESLint-plugin rules, so it's additive, not a
   replacement for step 6)
8. `npm run format:check` — new; `prettier --check .`
9. `npm run test:coverage` — new; `vitest run --coverage`, thresholds enforced (see below)
10. `actions/upload-artifact@v4` — upload `coverage/` for inspection (`if: always()`)

## Coverage

**Critical fix required first:** running `vitest run --coverage` today causes mass test
timeouts. The v8 coverage instrumentation slows down the type-checking-heavy
`@typescript-eslint/rule-tester` cases enough that many individual tests exceed the default
5000ms `testTimeout`. Verified locally that raising `testTimeout` to `20000` in
`vitest.config.ts` fixes this (full suite: 282 files / 4108 tests, all passing under
coverage with the raised timeout). This must ship regardless of CI, or `test:coverage`
fails on the very first run.

**Baseline (measured locally, all 4108 tests passing):**

| Metric     | Current | Threshold set |
| ---------- | ------- | ------------- |
| Statements | 86.98%  | 86%           |
| Lines      | 86.98%  | 86%           |
| Branches   | 80.51%  | 80%           |
| Functions  | 90.40%  | 90%           |

Thresholds are set just under today's measured numbers (via `coverage.thresholds` in
`vitest.config.ts`) so CI passes immediately and ratchets up as coverage improves. Target
is 80%+ across all four metrics, already true except branches, which sits right at the
line.

**Coverage config** (`vitest.config.ts`, `test.coverage`):

- `provider: "v8"`
- `reporter: ["text", "lcov", "html", "json-summary"]` — `lcov` matches
  `sonar-project.properties`' existing `sonar.javascript.lcov.reportPaths=coverage/lcov.info`
- `exclude`: test files, config files, `dist/`

## package.json changes

New scripts:

- `test:coverage`: `vitest run --coverage`
- `format`: `prettier --write .`
- `format:check`: `prettier --check .`
- `lint:oxlint`: `oxlint .`

New devDependencies:

- `@vitest/coverage-v8` (v3.x, matching installed `vitest` major)
- `prettier`
- `oxlint`

New config files:

- `.prettierrc` — default/standard settings (no project-specific style signal found;
  use Prettier defaults)
- `.prettierignore` — excludes `dist/`, `coverage/`, `node_modules/`

## Repo-level changes

- Remove `package-lock.json` from the root `.gitignore`; commit the lockfile so `npm ci`
  is reproducible in CI.
- One-time `prettier --write .` pass over the existing codebase, as its own isolated
  commit (separate from the CI-wiring commits) — measured locally: 955 of ~960 files have
  no prior formatting applied, since there's no existing Prettier setup. One clean
  "apply formatting" commit now, then `format:check` enforces it going forward.
- No `oxlint --fix` pass needed: oxlint's default exit code is `0` when only warnings are
  present (only actual `error`-severity findings fail the run), and a local run today
  produces warnings only (mostly pre-existing unused-variable/helper findings in rule
  files). CI will surface these as advisory output without blocking merges; cleaning them
  up is a separate future effort, not part of this CI setup.
- `.github/dependabot.yml`: weekly `npm` ecosystem updates scoped to
  `/eslint-lensflow-plugin`, plus weekly `github-actions` ecosystem updates for the
  workflow itself.
- CI status badge added to the top of `eslint-lensflow-plugin/README.md`, pointing at
  `ci.yml`.

## Testing / verification

- Run the full workflow logic locally (`npm ci`, typecheck, build, lint, oxlint,
  format:check, test:coverage) before pushing, to catch issues the automated codemods
  (`prettier --write`, `oxlint --fix`) didn't fully resolve.
- After the workflow is pushed, confirm it runs green on the branch's own PR.

## Follow-ups (out of scope here, call out to user)

- Configure branch protection on `main` to require the `ci` check before merge (GitHub
  repo settings, not a file change).
- Revisit workflow structure (matrix/path-filtering) once a second plugin subdirectory
  exists.
