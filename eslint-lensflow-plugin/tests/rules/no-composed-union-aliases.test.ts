import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/no-composed-union-aliases.js";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEST_FILENAME = "tests/rules/test.ts";
const TS_CONFIG_DIR = resolve(__dirname, "../..");
const TS_CONFIG = resolve(TS_CONFIG_DIR, "tsconfig.test.json");

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

ruleTester.run("no-composed-union-aliases", rule, {
  valid: [
    // Flat union with inline type literals — no composition
    {
      filename: TEST_FILENAME,
      code: `type C =
  | { kind: "a"; x: number }
  | { kind: "b"; y: string }
  | { kind: "c"; z: boolean };`,
    },
    // Single union member — nothing to compose
    {
      filename: TEST_FILENAME,
      code: `type Single = { kind: "only"; value: number };`,
    },
    // Union of non-union aliases
    {
      filename: TEST_FILENAME,
      code: `type A = { kind: "a"; x: number };
type B = { kind: "b"; y: string };
type C = A | B;`,
    },
    // Not a union at all
    {
      filename: TEST_FILENAME,
      code: `type Simple = string | number;`,
    },
    // Composed union BUT shared discriminant — TypeScript flattens, nesting costs nothing
    {
      filename: TEST_FILENAME,
      code: `type A = { kind: "a"; x: number } | { kind: "b"; y: string };
type B = { kind: "c"; z: boolean } | { kind: "d"; w: object };
type C = A | B;`,
    },
    // One member is a union, the other is not — but shared discriminant
    {
      filename: TEST_FILENAME,
      code: `type A = { kind: "a"; x: number } | { kind: "b"; y: string };
type B = { kind: "c"; z: boolean };
type C = A | B;`,
    },
    // Three aliases, two are unions — shared discriminant
    {
      filename: TEST_FILENAME,
      code: `type X = { kind: "x1" } | { kind: "x2" };
type Y = { kind: "y1" };
type Z = { kind: "z1" } | { kind: "z2" };
type All = X | Y | Z;`,
    },
    // Transitive union alias with shared discriminant
    {
      filename: TEST_FILENAME,
      code: `type A = { kind: "a" } | { kind: "b" };
type AliasA = A;
type C = AliasA | { kind: "c" };`,
    },
    // Parenthesized union wrapper with shared discriminant
    {
      filename: TEST_FILENAME,
      code: `type A = { kind: "a" } | { kind: "b" };
type B = { kind: "c" };
type D = { kind: "d" };
type C = (A | B) | D;`,
    },
    // Composed union with shared discriminant + primitive non-object member
    // findCommonDiscriminants filters to only object types, so `string` is ignored
    {
      filename: TEST_FILENAME,
      code: `type A = { kind: "a" } | { kind: "b" };
type C = A | string;`,
    },
    // Composed union with shared discriminant + null
    {
      filename: TEST_FILENAME,
      code: `type A = { kind: "a" } | { kind: "b" };
type C = A | null;`,
    },
    // Composed union with shared discriminant + undefined
    {
      filename: TEST_FILENAME,
      code: `type A = { kind: "a" } | { kind: "b" };
type C = A | undefined;`,
    },
    // Composed union with shared discriminant + nullable primitive
    {
      filename: TEST_FILENAME,
      code: `type A = { kind: "a" } | { kind: "b" };
type C = A | string | null;`,
    },
  ],
  invalid: [
    // Composed union with different discriminant fields — no single check narrows the whole union
    {
      filename: TEST_FILENAME,
      code: `type A = { kind: "a"; x: number } | { kind: "b"; y: string };
type B = { tag: "c"; z: boolean } | { tag: "d"; w: object };
type C = A | B;`,
      errors: [{ messageId: "composed" }],
    },
    // Union alias + inline type with different discriminant
    {
      filename: TEST_FILENAME,
      code: `type A = { kind: "a" } | { kind: "b" };
type D = { status: "ready" };
type C = A | D;`,
      errors: [{ messageId: "composed" }],
    },
    // Three aliases, mixed discriminants
    {
      filename: TEST_FILENAME,
      code: `type X = { kind: "x1" } | { kind: "x2" };
type Y = { id: "y1" };
type Z = { kind: "z1" } | { kind: "z2" };
type All = X | Y | Z;`,
      errors: [{ messageId: "composed" }],
    },
    // Transitive union alias with different discriminants
    {
      filename: TEST_FILENAME,
      code: `type A = { kind: "a" } | { kind: "b" };
type AliasA = A;
type C = AliasA | { tag: "c" };`,
      errors: [{ messageId: "composed" }],
    },
  ],
});
