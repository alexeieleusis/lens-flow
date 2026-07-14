import path from "node:path";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/no-incompatible-generic-intersection.js";

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

ruleTester.run("no-incompatible-generic-intersection", rule, {
  valid: [
    // Union instead of intersection — the correct pattern
    {
      filename: TEST_FILENAME,
      code: `type Good = Array<string> | Array<number>;`,
    },
    // Different base types — not incompatible
    {
      filename: TEST_FILENAME,
      code: `type Fine = Array<string> & ReadonlyArray<string>;`,
    },
    // Same base type, same type parameters — resolves fine
    {
      filename: TEST_FILENAME,
      code: `type Ok = Array<string> & Array<string>;`,
    },
    // Non-generic intersection — different base types
    {
      filename: TEST_FILENAME,
      code: `type Merged = { a: string } & { b: number };`,
    },
    // Qualified type name — same base, same params
    {
      filename: TEST_FILENAME,
      code: `type OkNS = NS.MyArray<string> & NS.MyArray<string>;`,
    },
  ],
  invalid: [
    // Array<string> & Array<number> — no value can satisfy both
    {
      filename: TEST_FILENAME,
      code: `type Bad = Array<string> & Array<number>;`,
      errors: [{ messageId: "incompatible" }],
    },
    // Map with incompatible key and value types
    {
      filename: TEST_FILENAME,
      code: `type Worse = Map<string, number> & Map<boolean, string>;`,
      errors: [{ messageId: "incompatible" }],
    },
    // Set with incompatible element types
    {
      filename: TEST_FILENAME,
      code: `type BadSet = Set<string> & Set<number>;`,
      errors: [{ messageId: "incompatible" }],
    },
    // Multiple members, at least one incompatible pair
    {
      filename: TEST_FILENAME,
      code: `type Complex = Array<string> & Iterable<unknown> & Array<number>;`,
      errors: [{ messageId: "incompatible" }],
    },
    // Qualified type name — same base, incompatible params
    {
      filename: TEST_FILENAME,
      code: `type BadNS = NS.MyArray<string> & NS.MyArray<number>;`,
      errors: [{ messageId: "incompatible" }],
    },
  ],
});
