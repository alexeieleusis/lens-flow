import path from "node:path";
import { fileURLToPath } from "node:url";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/require-unknown-after-json-parse.js";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
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

ruleTester.run("require-unknown-after-json-parse", rule, {
  valid: [
    {
      filename: TEST_FILENAME,
      code: `function loadName(path: string): string {
  const fs = require("fs");
  const raw: unknown = JSON.parse(fs.readFileSync(path, "utf-8"));
  if (typeof raw === "object" && raw !== null && "name" in raw) {
    return (raw as { name: string }).name;
  }
  throw new Error("Missing name field");
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `const data: unknown = JSON.parse('{ "key": "value" }');`,
    },
    {
      filename: TEST_FILENAME,
      code: `const parsed = JSON.parse('{ "key": "value" }') as unknown;`,
    },
    {
      filename: TEST_FILENAME,
      code: `function safe() {
  const x = JSON.parse("{}", undefined, 0) as unknown;
  return x;
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `const data = JSON.parse('{ "key": "value" }') satisfies unknown;`,
    },
    {
      filename: TEST_FILENAME,
      code: `const parsed = (JSON.parse('{ "key": "value" }')) as unknown;`,
    },
   {
      filename: TEST_FILENAME,
      code: `const data = JSON.parse('{ "key": "value" }')! satisfies unknown;`,
    },
  ],
  invalid: [
    {
      filename: TEST_FILENAME,
      code: `function loadName(path: string): string {
  const fs = require("fs");
  const data = JSON.parse(fs.readFileSync(path, "utf-8"));
  return data.name;
}`,
      errors: [{ messageId: "missingUnknownCast" }],
    },
    {
      filename: TEST_FILENAME,
      code: `const data = JSON.parse('{ "key": "value" }');
console.log(data.key);`,
      errors: [{ messageId: "missingUnknownCast" }],
    },
    {
      filename: TEST_FILENAME,
      code: `function unsafe() {
  return JSON.parse('{"a":1}');
}`,
      errors: [{ messageId: "missingUnknownCast" }],
    },
    {
      filename: TEST_FILENAME,
      code: `const result: Record<string, unknown> = JSON.parse('{"x": 1}');`,
      errors: [{ messageId: "missingUnknownCast" }],
    },
    {
      filename: TEST_FILENAME,
      code: `const x = JSON.parse('{"a": 1}') as string;`,
      errors: [{ messageId: "missingUnknownCast" }],
    },
    {
      filename: TEST_FILENAME,
      code: `const val = JSON.parse('{ "key": "value" }')?.key;`,
      errors: [{ messageId: "missingUnknownCast" }],
    },
  ],
});
