import path from "node:path";
import { fileURLToPath } from "node:url";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/no-silent-never-infer-fallback.js";

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

ruleTester.run("no-silent-never-infer-fallback", rule, {
  valid: [
    // Constrained type parameter — non-matching usage is a compile error
    {
      filename: TEST_FILENAME,
      code: `type First<T extends unknown[]> = T extends [infer A, ...infer _] ? A : never;`,
    },
    // Constrained to specific union — non-matching usage is a compile error
    {
      filename: TEST_FILENAME,
      code: `type Head<T extends [unknown, ...unknown[]]> = T extends [infer H, ...infer _] ? H : never;`,
    },
    // No infer in the check type — rule doesn't apply
    {
      filename: TEST_FILENAME,
      code: `type IsString<T> = T extends string ? true : never;`,
    },
    // False branch is not `never` — no silent never fallback
    {
      filename: TEST_FILENAME,
      code: `type First<T> = T extends [infer A, ...infer _] ? A : T;`,
    },
    // Nested infer with constraint on the type parameter
    {
      filename: TEST_FILENAME,
      code: `type Unwrap<T extends object[]> = T extends [infer U extends object, ...infer _] ? U : never;`,
    },
  ],
  invalid: [
    // Unconstrained T with infer and never fallback — silent failure
    {
      filename: TEST_FILENAME,
      code: `type First<T> = T extends [infer A, ...infer _] ? A : never;`,
      errors: [{ messageId: "silentNeverInferFallback" }],
    },
    // Unconstrained T extends unknown — still effectively unconstrained
    {
      filename: TEST_FILENAME,
      code: `type First<T extends unknown> = T extends [infer A, ...infer _] ? A : never;`,
      errors: [{ messageId: "silentNeverInferFallback" }],
    },
    // Multiple type params, one unconstrained with infer/never pattern
    {
      filename: TEST_FILENAME,
      code: `type Extract<T, U> = T extends [infer A, ...infer _] ? A : never;`,
      errors: [{ messageId: "silentNeverInferFallback" }],
    },
  ],
});
