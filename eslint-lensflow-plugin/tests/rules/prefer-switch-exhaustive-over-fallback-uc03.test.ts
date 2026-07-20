import path from "node:path";
import { fileURLToPath } from "node:url";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/prefer-switch-exhaustive-over-fallback-uc03.js";

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

ruleTester.run("prefer-switch-exhaustive-over-fallback-uc03", rule, {
  valid: [
    // All cases handled — no missing values
    {
      filename: TEST_FILENAME,
      code: `type Command = "start" | "stop" | "pause";

function execute(cmd: Command): string {
  if (cmd === "start") return "play";
  if (cmd === "stop") return "stop";
  if (cmd === "pause") return "pause";
  return "done";
}`,
    },
    // Two ifs for a 2-value union — all handled
    {
      filename: TEST_FILENAME,
      code: `type Command = "start" | "stop";

function execute(cmd: Command): string {
  if (cmd === "start") return "play";
  if (cmd === "stop") return "stop";
  return "done";
}`,
    },
    // Switch statement — not an if chain
    {
      filename: TEST_FILENAME,
      code: `type Command = "start" | "stop" | "pause" | "resume";

function execute(cmd: Command): string {
  switch (cmd) {
    case "start": return "play";
    case "stop": return "stop";
    case "pause": return "pause";
    default: return "?";
  }
}`,
    },
    // Non-union type — should not trigger
    {
      filename: TEST_FILENAME,
      code: `function execute(cmd: string): string {
  if (cmd === "start") return "play";
  if (cmd === "stop") return "stop";
  return "?";
}`,
    },
    // Single literal type — not a union
    {
      filename: TEST_FILENAME,
      code: `type Command = "start";

function execute(cmd: Command): string {
  if (cmd === "start") return "play";
  return "?";
}`,
    },
    // if-else chain with all cases handled
    {
      filename: TEST_FILENAME,
      code: `type Status = "a" | "b" | "c";

function handle(s: Status): string {
  if (s === "a") return "a";
  else if (s === "b") return "b";
  else if (s === "c") return "c";
  else return "?";
}`,
    },
    // No fallback return after the if chain
    {
      filename: TEST_FILENAME,
      code: `type Command = "start" | "stop" | "pause";

function execute(cmd: Command): string {
  if (cmd === "start") return "play";
  if (cmd === "stop") return "stop";
  throw new Error("unhandled");
}`,
    },
    // Comparing different variables — not a chain
    {
      filename: TEST_FILENAME,
      code: `type A = "x" | "y";
type B = "p" | "q";

function test(a: A, b: B): string {
  if (a === "x") return "x";
  if (b === "p") return "p";
  return "?";
}`,
    },
  ],
  invalid: [
    // Missing one case — "resume" not handled
    {
      filename: TEST_FILENAME,
      code: `type Command = "start" | "stop" | "pause" | "resume";

function execute(cmd: Command): string {
  if (cmd === "start") return "play";
  if (cmd === "stop") return "stop";
  if (cmd === "pause") return "pause";
  return "?";
}`,
      errors: [{ messageId: "nonExhaustiveFallback" }],
    },
    // Missing two cases
    {
      filename: TEST_FILENAME,
      code: `type Status = "idle" | "loading" | "success" | "error";

function describeStatus(s: Status): string {
  if (s === "idle") return "waiting";
  if (s === "loading") return "loading";
  return "unknown";
}`,
      errors: [{ messageId: "nonExhaustiveFallback" }],
    },
    // if-else-if chain missing cases
    {
      filename: TEST_FILENAME,
      code: `type Mode = "dark" | "light" | "auto" | "custom";

function getMode(m: Mode): string {
  if (m === "dark") return "#000";
  else if (m === "light") return "#fff";
  else if (m === "auto") return "sys";
  else return "?";
}`,
      errors: [{ messageId: "nonExhaustiveFallback" }],
    },
    // Arrow function with missing case
    {
      filename: TEST_FILENAME,
      code: `type Color = "red" | "green" | "blue" | "yellow";

const getColor = (c: Color): string => {
  if (c === "red") return "#f00";
  if (c === "green") return "#0f0";
  if (c === "blue") return "#00f";
  return "#000";
}`,
      errors: [{ messageId: "nonExhaustiveFallback" }],
    },
    // Right-side literal comparison
    {
      filename: TEST_FILENAME,
      code: `type Action = "add" | "remove" | "update";

function handleAction(a: Action): number {
  if ("add" === a) return 1;
  if ("update" === a) return 2;
  return 0;
}`,
      errors: [{ messageId: "nonExhaustiveFallback" }],
    },
  ],
});
