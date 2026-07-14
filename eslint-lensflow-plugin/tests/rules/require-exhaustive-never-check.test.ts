import path from "node:path";
import { fileURLToPath } from "node:url";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/require-exhaustive-never-check.js";

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

ruleTester.run("require-exhaustive-never-check", rule, {
  valid: [
    // If-else chain: all variants handled, final else calls assertNever
    {
      filename: TEST_FILENAME,
      code: `type Message = { type: "a" } | { type: "b" } | { type: "c" };
function handleExhaustive(m: Message) {
  if (m.type === "a") return "alpha";
  if (m.type === "b") return "beta";
  return assertNever(m);
}`,
    },
    // If-else chain: all variants handled, no fallback needed
    {
      filename: TEST_FILENAME,
      code: `type Message = { type: "a" } | { type: "b" };
function handle(m: Message) {
  if (m.type === "a") return "alpha";
  if (m.type === "b") return "beta";
}`,
    },
    // Switch: all variants handled
    {
      filename: TEST_FILENAME,
      code: `type Message = { type: "a" } | { type: "b" } | { type: "c" };
function handle(msg: Message) {
  switch (msg.type) {
    case "a": return "alpha";
    case "b": return "beta";
    case "c": return "gamma";
  }
}`,
    },
    // Switch: some variants unhandled but default has assertNever
    {
      filename: TEST_FILENAME,
      code: `type Message = { type: "a" } | { type: "b" } | { type: "c" };
function handle(msg: Message) {
  switch (msg.type) {
    case "a": return "alpha";
    default: assertNever(msg);
  }
}`,
    },
    // Switch: some variants unhandled but default has throw
    {
      filename: TEST_FILENAME,
      code: `type Message = { type: "a" } | { type: "b" } | { type: "c" };
function handle(msg: Message) {
  switch (msg.type) {
    case "a": return "alpha";
    default: throw new Error("unhandled");
  }
}`,
    },
    // Non-union type — not applicable
    {
      filename: TEST_FILENAME,
      code: `function handle(status: number) {
  switch (status) {
    case 200: return "ok";
  }
}`,
    },
    // If-else chain: single variant type — not a union
    {
      filename: TEST_FILENAME,
      code: `type Single = { type: "only" };
function handle(m: Single) {
  if (m.type === "only") return "it";
  return "fallback";
}`,
    },
    // If-else chain: fallback calls assertNever (not returning literal)
    {
      filename: TEST_FILENAME,
      code: `type Status = "idle" | "loading" | "done";
function handle(s: Status) {
  if (s === "idle") return 0;
  if (s === "loading") return 1;
  return assertNever(s);
}`,
    },
    // If-else chain: fallback has throw
    {
      filename: TEST_FILENAME,
      code: `type Status = "idle" | "loading" | "done";
function handle(s: Status) {
  if (s === "idle") return 0;
  throw new Error("not idle");
}`,
    },
    // Number literal union in switch: all handled
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
    // Number literal union in switch: unhandled but default has assertNever
    {
      filename: TEST_FILENAME,
      code: `type Code = 1 | 2 | 3;
function handle(c: Code) {
  switch (c) {
    case 1: break;
    default: assertNever(c as never);
  }
}`,
    },
  ],
  invalid: [
    // If-else chain: missing "c", fallback returns literal
    {
      filename: TEST_FILENAME,
      code: `type Message = { type: "a" } | { type: "b" } | { type: "c" };
function handlePartial(m: Message) {
  if (m.type === "a") return "alpha";
  if (m.type === "b") return "beta";
  return "unknown";
}`,
      errors: [{ messageId: "ifChainMissingNeverCheck" }],
    },
    // Switch: missing variants, no default at all
    {
      filename: TEST_FILENAME,
      code: `type Message = { type: "a" } | { type: "b" } | { type: "c" };
function handle(msg: Message) {
  switch (msg.type) {
    case "a": return "alpha";
  }
}`,
      errors: [{ messageId: "switchMissingNeverCheck" }],
    },
    // Switch: missing variants, default returns literal
    {
      filename: TEST_FILENAME,
      code: `type Message = { type: "a" } | { type: "b" } | { type: "c" };
function handle(msg: Message) {
  switch (msg.type) {
    case "a": return "alpha";
    default: return "unknown";
  }
}`,
      errors: [{ messageId: "switchMissingNeverCheck" }],
    },
    // Switch: missing all variants, default is empty
    {
      filename: TEST_FILENAME,
      code: `type Status = "idle" | "loading" | "done";
function handle(s: Status) {
  switch (s) {
    default:
  }
}`,
      errors: [{ messageId: "switchMissingNeverCheck" }],
    },
    // If-else chain: missing all variants, fallback returns literal
    {
      filename: TEST_FILENAME,
      code: `type Status = "idle" | "loading" | "done";
function handle(s: Status) {
  if (s === "idle") return 0;
  return -1;
}`,
      errors: [{ messageId: "ifChainMissingNeverCheck" }],
    },
    // Number literal union in switch: missing variants
    {
      filename: TEST_FILENAME,
      code: `type Code = 1 | 2 | 3;
function handle(c: Code) {
  switch (c) {
    case 1: return "one";
    default: return "other";
  }
}`,
      errors: [{ messageId: "switchMissingNeverCheck" }],
    },
    // If-else chain: simple discriminant (not member expression)
    {
      filename: TEST_FILENAME,
      code: `type Action = "add" | "remove" | "clear";
function handle(a: Action) {
  if (a === "add") return 1;
  if (a === "remove") return -1;
  return 0;
}`,
      errors: [{ messageId: "ifChainMissingNeverCheck" }],
    },
    // Switch: default with break (no never assertion)
    {
      filename: TEST_FILENAME,
      code: `type Message = { type: "a" } | { type: "b" } | { type: "c" };
function handle(msg: Message) {
  switch (msg.type) {
    case "a": break;
    default: break;
  }
}`,
      errors: [{ messageId: "switchMissingNeverCheck" }],
    },
  ],
});
