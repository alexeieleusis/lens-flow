import path from "node:path";   
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/prefer-unknown-over-any.js";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const TEST_FILENAME = "file.ts";
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

ruleTester.run("prefer-unknown-over-any", rule, {
  valid: [
    {
      filename: TEST_FILENAME,
      code: `function parseResponse(json: unknown) {
  if (typeof json === "string") return json;
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `function handle(data: any) {
  console.log(data.foo);
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `function process(x: any) {
  return x.toString();
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `function identity(x: any) {
  return x;
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `function isString(x: string | number): x is string {
  return typeof x === "string";
}`,
    },
  ],
  invalid: [
    {
      filename: TEST_FILENAME,
      code: `function parseResponse(json: any) {
  if (typeof json === "string") return json;
}`,
      errors: [{ messageId: "preferUnknown" }],
    },
    {
      filename: TEST_FILENAME,
      code: `function checkType(data: any) {
  if (data instanceof Date) {
    return data.toISOString();
  }
  return String(data);
}`,
      errors: [{ messageId: "preferUnknown" }],
    },
  ],
});
