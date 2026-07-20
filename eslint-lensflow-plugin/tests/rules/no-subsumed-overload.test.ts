import path from "node:path";
import { fileURLToPath } from "node:url";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/no-subsumed-overload.js";

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

ruleTester.run("no-subsumed-overload", rule, {
  valid: [
    {
      filename: TEST_FILENAME,
      code: `// Narrow first, then broad — correct ordering
function parse(v: number): number;
function parse(v: string): string;
function parse(v: string | number): string | number { return v; }`,
    },
    {
      filename: TEST_FILENAME,
      code: `// Single generic overload — no subsumption
function map<T, U>(arr: T[], fn: (x: T) => U): U[] { return arr.map(fn); }`,
    },
    {
      filename: TEST_FILENAME,
      code: `// Two overloads with different param counts — not subsumed
function f(x: number): void;
function f(x: number, y: string): void;
function f(x: number, y?: string): void { }`,
    },
    {
      filename: TEST_FILENAME,
      code: `// Overloads with unrelated types — not subsumed
function g(x: number): string;
function g(x: string): number;
function g(x: string | number): string | number { return x; }`,
    },
    {
      filename: TEST_FILENAME,
      code: `// Valid — ambient overloads with correct ordering (TSDeclareFunction)
declare function parse(v: number): number;
declare function parse(v: string): string;`,
    },
  ],
  invalid: [
    {
      filename: TEST_FILENAME,
      code: `// First overload is subsumed by the second (U = number case)
function map<T>(arr: T[], fn: (x: T) => number): number[];
function map<T, U>(arr: T[], fn: (x: T) => U): U[];
function map<T, U>(arr: T[], fn: (x: T) => U): U[] { return arr.map(fn); }`,
      errors: [{ messageId: "subsumed" }],
    },
    {
      filename: TEST_FILENAME,
      code: `// Specific overload subsumed by generic
function convert(x: string): string;
function convert<T extends string>(x: T): T;
function convert<T extends string>(x: T): T { return x; }`,
      errors: [{ messageId: "subsumed" }],
    },
    {
      filename: TEST_FILENAME,
      code: `// Number overload subsumed by generic
function getId(): number;
function getId<T = number>(): T;
function getId<T = number>(): T { return 1 as T; }`,
      errors: [{ messageId: "subsumed" }],
    },
    {
      filename: TEST_FILENAME,
      code: `// Invalid — ambient overload subsumed by broader overload (TSDeclareFunction)
declare function map<T>(arr: T[], fn: (x: T) => number): number[];
declare function map<T, U>(arr: T[], fn: (x: T) => U): U[];`,
      errors: [{ messageId: "subsumed" }],
    },
  ],
});
