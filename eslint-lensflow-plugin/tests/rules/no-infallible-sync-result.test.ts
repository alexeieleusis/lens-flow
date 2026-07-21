import path from "node:path";
import { fileURLToPath } from "node:url";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/no-infallible-sync-result.js";

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

const RESULT_DEF = `
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
`;

const EITHER_DEF = `
type Either<L, R> = { left: true; value: L } | { left: false; value: R };
`;

ruleTester.run("no-infallible-sync-result", rule, {
  valid: [
    // Plain return — not wrapped in Result
    {
      filename: TEST_FILENAME,
      code:
        RESULT_DEF +
        `
function isEven(n: number): boolean {
  return n % 2 === 0;
}`,
    },
    // Async function — may have failure path
    {
      filename: TEST_FILENAME,
      code:
        RESULT_DEF +
        `
async function fetchValue(): Promise<Result<number, string>> {
  const res = await fetch("/api");
  return { ok: true, value: 42 };
}`,
    },
    // Function that throws — has a failure path
    {
      filename: TEST_FILENAME,
      code:
        RESULT_DEF +
        `
function parse(s: string): Result<number, string> {
  const n = Number(s);
  if (isNaN(n)) throw new Error("invalid");
  return { ok: true, value: n };
}`,
    },
    // Function with try/catch — has a failure path
    {
      filename: TEST_FILENAME,
      code:
        RESULT_DEF +
        `
function compute(x: string): Result<number, string> {
  try {
    return { ok: true, value: Number(x) };
  } catch {
    return { ok: false, error: "parse failed" };
  }
}`,
    },
    // Non-never error type — may actually fail
    {
      filename: TEST_FILENAME,
      code:
        RESULT_DEF +
        `
function heavy(n: number): Result<number, string> {
  return { ok: true, value: n * 2 };
}`,
    },
    // Generic function (factory helper) — should be skipped
    {
      filename: TEST_FILENAME,
      code:
        RESULT_DEF +
        `
function ok<T>(v: T): Result<T, never> {
  return { ok: true, value: v };
}`,
    },
  ],
  invalid: [
    // Sync function with Result<T, never> and no failure path
    {
      filename: TEST_FILENAME,
      code:
        RESULT_DEF +
        `
function isEven(n: number): Result<boolean, never> {
  return { ok: true, value: n % 2 === 0 };
}`,
      errors: [{ messageId: "infallibleSyncResult" }],
    },
    // Arrow function with Result<T, never>
    {
      filename: TEST_FILENAME,
      code:
        RESULT_DEF +
        `
const double = (n: number): Result<number, never> => ({ ok: true, value: n * 2 });`,
      errors: [{ messageId: "infallibleSyncResult" }],
    },
    // Either<never, T> — error type (first param) is never
    {
      filename: TEST_FILENAME,
      code:
        EITHER_DEF +
        `
function toEither(n: number): Either<never, number> {
  return { left: false, value: n };
}`,
      errors: [{ messageId: "infallibleSyncResult" }],
    },
    // Nested arrow function with throw doesn't count as outer's failure path
    {
      filename: TEST_FILENAME,
      code:
        RESULT_DEF +
        `
function compute(n: number): Result<number, never> {
  const validate = () => { throw new Error("bad"); };
  return { ok: true, value: n * 2 };
}`,
      errors: [{ messageId: "infallibleSyncResult" }],
    },
  ],
});
