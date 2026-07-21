import path from "node:path";
import { fileURLToPath } from "node:url";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/no-unknown-type-predicate.js";

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

ruleTester.run("no-unknown-type-predicate", rule, {
  valid: [
    {
      filename: TEST_FILENAME,
      code: `function isStringInUnion(x: string | number): x is string {
  return typeof x === "string";
}

function g(x: string | number): void {
  if (isStringInUnion(x)) {
    x.toUpperCase();
  } else {
    x.toFixed(2);
  }
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `function isNumber(x: string | number | boolean): x is number {
  return typeof x === "number";
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `function regular(x: unknown): boolean {
  return typeof x === "string";
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `function isString(x: string | number): x is string;
function isString(x) { return typeof x === "string"; }`,
    },
  ],
  invalid: [
    {
      filename: TEST_FILENAME,
      code: `function isString(x: unknown): x is string {
  return typeof x === "string";
}`,
      errors: [{ messageId: "unknownTypePredicate" }],
    },
    {
      filename: TEST_FILENAME,
      code: `function isString(x: any): x is string {
  return typeof x === "string";
}`,
      errors: [{ messageId: "unknownTypePredicate" }],
    },
    {
      filename: TEST_FILENAME,
      code: `const isString = (x: unknown): x is string => typeof x === "string";`,
      errors: [{ messageId: "unknownTypePredicate" }],
    },
    {
      filename: TEST_FILENAME,
      code: `const isString = function(x: unknown): x is string {
  return typeof x === "string";
};`,
      errors: [{ messageId: "unknownTypePredicate" }],
    },
    {
      filename: TEST_FILENAME,
      code: `type Predicate = (x: unknown) => x is string;`,
      errors: [{ messageId: "unknownTypePredicate" }],
    },
    {
      filename: TEST_FILENAME,
      code: `function isString(x: unknown): x is string;
function isString(x): x is string { return typeof x === "string"; }`,
      errors: [
        { messageId: "unknownTypePredicate" },
        { messageId: "unknownTypePredicate" },
      ],
    },
  ],
});
