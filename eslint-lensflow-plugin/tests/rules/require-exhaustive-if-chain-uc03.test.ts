import path from "node:path";
import { fileURLToPath } from "node:url";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/require-exhaustive-if-chain-uc03.js";

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

ruleTester.run("require-exhaustive-if-chain-uc03", rule, {
  valid: [
    // All cases handled in consecutive if chain — no missing values
    {
      filename: TEST_FILENAME,
      code: `type Role = "admin" | "moderator" | "viewer";

function canBan(u: { role: Role }): boolean {
  if (u.role === "admin") return true;
  if (u.role === "moderator") return true;
  if (u.role === "viewer") return false;
  return false;
}`,
    },
    // Switch statement instead of if chain — not an if chain
    {
      filename: TEST_FILENAME,
      code: `type Role = "admin" | "moderator" | "viewer";

function canBan(u: { role: Role }): boolean {
  switch (u.role) {
    case "admin": return true;
    case "moderator": return true;
    case "viewer": return false;
    default: throw new Error("unreachable");
  }
}`,
    },
    // Non-union type — should not trigger
    {
      filename: TEST_FILENAME,
      code: `function check(role: string): boolean {
  if (role === "admin") return true;
  return false;
}`,
    },
    // Single literal type — not a union
    {
      filename: TEST_FILENAME,
      code: `type Role = "admin";

function canBan(u: { role: Role }): boolean {
  if (u.role === "admin") return true;
  return false;
}`,
    },
    // If-else chain with all cases handled
    {
      filename: TEST_FILENAME,
      code: `type Status = "a" | "b" | "c";

function handle(s: Status): string {
  if (s === "a") return "a";
  else if (s === "b") return "b";
  else if (s === "c") return "c";
  else return "done";
}`,
    },
    // No fallback return — throws instead (throw is explicit, not silent)
    {
      filename: TEST_FILENAME,
      code: `type Role = "admin" | "moderator" | "viewer";

function canBan(u: { role: Role }): boolean {
  if (u.role === "admin") return true;
  if (u.role === "moderator") return true;
  throw new Error("unhandled");
}`,
    },
    // Direct identifier comparison — all handled
    {
      filename: TEST_FILENAME,
      code: `type Color = "red" | "blue";

function isRed(c: Color): boolean {
  if (c === "red") return true;
  if (c === "blue") return false;
  return false;
}`,
    },
  ],
  invalid: [
    // Single if with missing cases (from antipattern spec)
    {
      filename: TEST_FILENAME,
      code: `type User = { role: "admin" | "moderator" | "viewer" };

function canBan(u: User): boolean {
  if (u.role === "admin") return true;
  return false;
}`,
      errors: [{ messageId: "nonExhaustiveFallback" }],
    },
    // Consecutive if chain missing one case
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
    // If-else-if chain with missing cases
    {
      filename: TEST_FILENAME,
      code: `type Mode = "dark" | "light" | "auto" | "custom";

function getMode(m: Mode): string {
  if (m === "dark") return "#000";
  else if (m === "light") return "#fff";
  else return "?";
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
    // Arrow function with missing case
    {
      filename: TEST_FILENAME,
      code: `type Color = "red" | "green" | "blue" | "yellow";

const getColor = (c: Color): string => {
  if (c === "red") return "#f00";
  if (c === "green") return "#0f0";
  return "#000";
}`,
      errors: [{ messageId: "nonExhaustiveFallback" }],
    },
    // Right-side literal comparison with missing case
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
    // Different variables — second if chain on `b` has incomplete fallback
    {
      filename: TEST_FILENAME,
      code: `type A = "x" | "y";
type B = "p" | "q";

function test(a: A, b: B): string {
  if (a === "x") return "x";
  if (b === "p") return "p";
  return "?";
}`,
      errors: [{ messageId: "nonExhaustiveFallback" }],
    },
  ],
});
