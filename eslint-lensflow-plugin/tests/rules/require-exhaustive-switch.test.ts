import path from "node:path";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/require-exhaustive-switch.js";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

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

ruleTester.run("require-exhaustive-switch", rule, {
  valid: [
    // All variants handled — no default needed
    {
      filename: TEST_FILENAME,
      code: `type Message = { type: "a" } | { type: "b" } | { type: "c" };
function handle(msg: Message) {
  switch (msg.type) {
    case "a": break;
    case "b": break;
    case "c": break;
  }
}`,
    },
    // All variants handled + default with assertNever
    {
      filename: TEST_FILENAME,
      code: `type Message = { type: "a" } | { type: "b" } | { type: "c" };
function handle(msg: Message) {
  switch (msg.type) {
    case "a": break;
    case "b": break;
    case "c": break;
    default: throw new Error(\`Unreachable: \${msg as never}\`);
  }
}`,
    },
    // Some variants missing but default has assertNever
    {
      filename: TEST_FILENAME,
      code: `type Message = { type: "a" } | { type: "b" } | { type: "c" };
function handle(msg: Message) {
  switch (msg.type) {
    case "a": break;
    default: assertNever(msg);
  }
}`,
    },
    // Some variants missing but default has throw
    {
      filename: TEST_FILENAME,
      code: `type Message = { type: "a" } | { type: "b" } | { type: "c" };
function handle(msg: Message) {
  switch (msg.type) {
    case "a": break;
    default: throw new Error("unhandled");
  }
}`,
    },
    // Non-union discriminant — not a discriminated union
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
      code: `type Single = { type: "only" };
function handle(msg: Single) {
  switch (msg.type) {
    case "only": break;
  }
}`,
    },
    // Number literal union — all handled
    {
      filename: TEST_FILENAME,
      code: `type Status = 1 | 2 | 3;
function handle(s: Status) {
  switch (s) {
    case 1: break;
    case 2: break;
    case 3: break;
  }
}`,
    },
  ],
  invalid: [
    // Missing variants, no default at all
    {
      filename: TEST_FILENAME,
      code: `type Message = { type: "a" } | { type: "b" } | { type: "c" };
function handle(msg: Message) {
  switch (msg.type) {
    case "a": break;
  }
}`,
      errors: [{ messageId: "missingVariants" }],
    },
    // Missing variants, default with no never-assertion (empty)
    {
      filename: TEST_FILENAME,
      code: `type Message = { type: "a" } | { type: "b" } | { type: "c" };
function handle(msg: Message) {
  switch (msg.type) {
    case "a": break;
    default:
  }
}`,
      errors: [{ messageId: "missingVariants" }],
    },
    // Missing variants, default with break
    {
      filename: TEST_FILENAME,
      code: `type Message = { type: "a" } | { type: "b" } | { type: "c" };
function handle(msg: Message) {
  switch (msg.type) {
    case "a": break;
    default: break;
  }
}`,
      errors: [{ messageId: "missingVariants" }],
    },
    // All variants missing, no default
    {
      filename: TEST_FILENAME,
      code: `type Status = "idle" | "loading" | "done";
function handle(s: Status) {
  switch (s) {
    default: return;
  }
}`,
      errors: [{ messageId: "missingVariants" }],
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
      errors: [{ messageId: "missingVariants" }],
    },
  ],
});
