import path from "node:path";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/no-redundant-infer-conditional.js";

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

ruleTester.run("no-redundant-infer-conditional", rule, {
  valid: [
    {
      filename: TEST_FILENAME,
      code: `type StringOrNumber = string | number;`,
    },
    {
      filename: TEST_FILENAME,
      code: `type ElementType<T> = T extends Array<infer U> ? U : never;`,
    },
    {
      filename: TEST_FILENAME,
      code: `type Lower<T> = T extends string | number ? string : never;`,
    },
    {
      filename: TEST_FILENAME,
      code: `type StringOrNumber<T> = T extends string | number ? T : unknown;`,
    },
    {
      filename: TEST_FILENAME,
      code: `type Filter<T> = T extends string | number ? T : never;`,
    },
    {
      filename: TEST_FILENAME,
      code: `type OnlyGreetings<T> = T extends "hello" | "world" ? T : never;`,
    },
    {
      filename: TEST_FILENAME,
      code: `type X<T> = T extends string ? T : never;`,
    },
  ],
  invalid: [
    {
      filename: TEST_FILENAME,
      code: `type StringOrNumber<T extends string | number> = T extends string | number ? T : never;`,
      errors: [{ messageId: "redundantConditional" }],
    },
    {
      filename: TEST_FILENAME,
      code: `type OnlyGreetings<T extends "hello" | "world"> = T extends "hello" | "world" ? T : never;`,
      errors: [{ messageId: "redundantConditional" }],
    },
    {
      filename: TEST_FILENAME,
      code: `namespace TE { type Either = string | number; type Task = () => void; }
type X<T extends TE.Either | TE.Task> = T extends TE.Either | TE.Task ? T : never;`,
      errors: [{ messageId: "redundantConditional" }],
    },
  ],
});
