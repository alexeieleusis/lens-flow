import path from "node:path";
import { fileURLToPath } from "node:url";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/require-literal-switch-default.js";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const __dirname = path.resolve(fileURLToPath(import.meta.url), "..");
const TEST_FILENAME = "tests/rules/test.ts";
const TS_CONFIG_DIR = path.resolve(__dirname, "../..");
const TS_CONFIG = path.join(TS_CONFIG_DIR, "tsconfig.test.json");

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      project: TS_CONFIG,
      tsconfigRootDir: TS_CONFIG_DIR,
    },
  },
});

ruleTester.run("require-literal-switch-default", rule, {
  valid: [
    // All variants handled — no default needed
    {
      filename: TEST_FILENAME,
      code: `type State = "idle" | "loading" | "done";
function render(state: State) {
  switch (state) {
    case "idle": return "idle";
    case "loading": return "loading";
    case "done": return "done";
  }
}`,
    },
    // Missing variants but default has assertNever
    {
      filename: TEST_FILENAME,
      code: `type State = "idle" | "loading" | "done";
function render(state: State) {
  switch (state) {
    case "idle": return "idle";
    case "loading": return "loading";
    default: assertNever(state);
  }
}`,
    },
    // Missing variants but default has throw
    {
      filename: TEST_FILENAME,
      code: `type State = "idle" | "loading" | "done";
function render(state: State) {
  switch (state) {
    case "idle": return "idle";
    default: throw new Error("unhandled");
  }
}`,
    },
    // Non-literal union — not applicable
    {
      filename: TEST_FILENAME,
      code: `function handle(status: number) {
  switch (status) {
    case 200: break;
  }
}`,
    },
    // Single literal type — not a union
    {
      filename: TEST_FILENAME,
      code: `type Single = "only";
function handle(s: Single) {
  switch (s) {
    case "only": break;
  }
}`,
    },
    // Number literal union — all handled
    {
      filename: TEST_FILENAME,
      code: `type Code = 1 | 2 | 3;
function handle(c: Code) {
  switch (c) {
    case 1: break;
    case 2: break;
    case 3: break;
  }
}`,
    },
    // All handled + default with assertNever
    {
      filename: TEST_FILENAME,
      code: `type State = "idle" | "loading" | "done";
function render(state: State) {
  switch (state) {
    case "idle": return "idle";
    case "loading": return "loading";
    case "done": return "done";
    default: assertNever(state);
  }
}`,
    },
  ],
  invalid: [
    // Missing "done", no default at all
    {
      filename: TEST_FILENAME,
      code: `type State = "idle" | "loading" | "done";
function render(state: State) {
  switch (state) {
    case "idle": return "idle";
    case "loading": return "loading";
  }
}`,
      errors: [{ messageId: "missingDefaultExhaustiveness" }],
    },
    // Missing variants, default with break (no never-assertion)
    {
      filename: TEST_FILENAME,
      code: `type State = "idle" | "loading" | "done";
function render(state: State) {
  switch (state) {
    case "idle": return "idle";
    default: break;
  }
}`,
      errors: [{ messageId: "missingDefaultExhaustiveness" }],
    },
    // Missing variants, default is empty
    {
      filename: TEST_FILENAME,
      code: `type Status = "a" | "b" | "c";
function handle(s: Status) {
  switch (s) {
    case "a": break;
    default:
  }
}`,
      errors: [{ messageId: "missingDefaultExhaustiveness" }],
    },
    // Number literal union missing variants
    {
      filename: TEST_FILENAME,
      code: `type Code = 1 | 2 | 3;
function handle(c: Code) {
  switch (c) {
    case 1: break;
  }
}`,
      errors: [{ messageId: "missingDefaultExhaustiveness" }],
    },
    // All variants missing, no default
    {
      filename: TEST_FILENAME,
      code: `type Status = "idle" | "loading" | "done";
function handle(s: Status) {
  switch (s) {
  }
}`,
      errors: [{ messageId: "missingDefaultExhaustiveness" }],
    },
  ],
});
