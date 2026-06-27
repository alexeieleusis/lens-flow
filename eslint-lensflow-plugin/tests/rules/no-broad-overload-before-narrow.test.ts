import path from "node:path";
import { fileURLToPath } from "node:url";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/no-broad-overload-before-narrow.js";

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

ruleTester.run("no-broad-overload-before-narrow", rule, {
  valid: [
    {
      filename: TEST_FILENAME,
      code: `// Narrow first, then broad
function f(x: number): number;
function f(x: string): string;
function f(x: string | number): string { return String(x); }`,
    },
    {
      filename: TEST_FILENAME,
      code: `// Single overload — no ordering issue
function g(x: string | number): void;
function g(x: string | number): void { }`,
    },
    {
      filename: TEST_FILENAME,
      code: `// No overloads
function h(x: string): void { }`,
    },
    {
      filename: TEST_FILENAME,
      code: `// Two overloads with same parameter type — not a broad-before-narrow issue
function k(x: string): string;
function k(x: string): number;
function k(x: string): string | number { return x; }`,
    },
    {
      filename: TEST_FILENAME,
      code: `// declare function — narrow first, then broad
declare function f(x: number): number;
declare function f(x: string | number): string;
function f(x: string | number): string { return String(x); }`,
    },
    {
      filename: TEST_FILENAME,
      code: `// Unrelated parameter types — neither assignable to the other, should not report
function m(x: boolean): boolean;
function m(x: symbol): symbol;
function m(x: boolean | symbol): boolean | symbol { return x; }`,
    },
    {
      filename: TEST_FILENAME,
      code: `// Narrow first, then broad (reverse of violation) — should not report
function n(x: number): number;
function n(x: string | number): string;
function n(x: string | number): string { return String(x); }`,
    },
    {
      filename: TEST_FILENAME,
      code: `// Different parameter counts — 2-param before 1-param, should not report
function p(x: string, y: number): void;
function p(z: string): void;
function p(x: string, y?: number): void { }`,
    },
  ],
  invalid: [
    {
      filename: TEST_FILENAME,
      code: `// Broad overload before narrow — narrow is unreachable
function f(x: string | number): string;
function f(x: number): number;
function f(x) { }`,
      errors: [{ messageId: "broadBeforeNarrow" }],
    },
    {
      filename: TEST_FILENAME,
      code: `// Another broad before narrow case
function parse(v: unknown): string;
function parse(v: string): string;
function parse(v: unknown): string { return String(v); }`,
      errors: [{ messageId: "broadBeforeNarrow" }],
    },
    {
      filename: TEST_FILENAME,
      code: `// declare function — broad before narrow, narrow is unreachable
declare function f(x: string | number): string;
declare function f(x: number): number;
function f(x: string | number): string { return String(x); }`,
      errors: [{ messageId: "broadBeforeNarrow" }],
    },
  ],
});
