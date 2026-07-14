import path from "node:path";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/no-mutable-array-in-readonly-context.js";

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

ruleTester.run("no-mutable-array-in-readonly-context", rule, {
  valid: [
    {
      filename: TEST_FILENAME,
      code: `const frozen: readonly string[] = ["a", "b"];
const mutable: string[] = [...frozen];`,
    },
    {
      filename: TEST_FILENAME,
      code: `const items: readonly number[] = [1, 2, 3];
const copy: number[] = items.slice();`,
    },
    {
      filename: TEST_FILENAME,
      code: `const data: readonly string[] = ["x", "y"];
const same: readonly string[] = data;`,
    },
    {
      filename: TEST_FILENAME,
      code: `const list: string[] = ["a", "b"];
const other: string[] = list;`,
    },
    // Union-wrapped: TSParenthesizedType + union — not a bare readonly array
    {
      filename: TEST_FILENAME,
      code: `const maybe: (readonly string[] | null) = ["a", "b"];
const assigned: readonly string[] | null = maybe;`,
    },
    // Intersection-wrapped: readonly array & extra shape — not a bare array
    {
      filename: TEST_FILENAME,
      code: `const tagged: readonly string[] & { readonly marker: true } =
  ["a"] as any;
const other = tagged;`,
    },
    // Union constituents: both members are readonly arrays
    {
      filename: TEST_FILENAME,
      code: `type ReadonlyStringOrNumber = readonly string[] | readonly number[];
const mixed: ReadonlyStringOrNumber = ["a", "b"];
const same: ReadonlyStringOrNumber = mixed;`,
    },
  ],
  invalid: [
    {
      filename: TEST_FILENAME,
      code: `const frozen: readonly string[] = ["a", "b"];
const mutable: string[] = frozen;`,
      errors: [{ messageId: "mutableAssignmentFromReadonly" }],
    },
    {
      filename: TEST_FILENAME,
      code: `const items: readonly number[] = [1, 2, 3];
const mutable: number[] = items;`,
      errors: [{ messageId: "mutableAssignmentFromReadonly" }],
    },
    {
      filename: TEST_FILENAME,
      code: `const data: ReadonlyArray<string> = ["x", "y"];
const mutable: string[] = data;`,
      errors: [{ messageId: "mutableAssignmentFromReadonly" }],
    },
    {
      filename: TEST_FILENAME,
      code: `const data: ReadonlyArray<string> = ["x", "y"];
const mutable: Array<string> = data;`,
      errors: [{ messageId: "mutableAssignmentFromReadonly" }],
    },
    // Type alias for readonly array — should still be detected
    {
      filename: TEST_FILENAME,
      code: `type ReadonlyStr = readonly string[];
const src: ReadonlyStr = ["a"];
const dst: string[] = src;`,
      errors: [{ messageId: "mutableAssignmentFromReadonly" }],
    },
    // TSParenthesizedType wrapping a readonly array
    {
      filename: TEST_FILENAME,
      code: `const src: (readonly string[]) = ["a"];
const dst: string[] = src;`,
      errors: [{ messageId: "mutableAssignmentFromReadonly" }],
    },
    // Readonly array in intersection assigned to mutable
    {
      filename: TEST_FILENAME,
      code: `const src: readonly string[] & { readonly marker: true } =
  ["a"] as any;
const dst: string[] = src;`,
      errors: [{ messageId: "mutableAssignmentFromReadonly" }],
    },
    // Union of readonly arrays assigned to mutable
    {
      filename: TEST_FILENAME,
      code: `type Union = readonly string[] | readonly number[];
const src: Union = ["a"];
const dst: string[] = src;`,
      errors: [{ messageId: "mutableAssignmentFromReadonly" }],
    },
  ],
});
