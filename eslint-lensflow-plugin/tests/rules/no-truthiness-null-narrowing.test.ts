import path from "node:path";
import { fileURLToPath } from "node:url";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/no-truthiness-null-narrowing.js";

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

ruleTester.run("no-truthiness-null-narrowing", rule, {
  valid: [
    {
      filename: TEST_FILENAME,
      code: `function process(n: number | null) {
  if (n !== null) console.log(n.toFixed(2));
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `function process(n: number | null) {
  if (n != null) console.log(n.toFixed(2));
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `function process(n: string | null) {
  if (n !== null) console.log(n.length);
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `function process(val: "a" | "b" | null) {
  if (val) console.log(val);
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `function handle(s: string | undefined) {
  if (s !== undefined) console.log(s.length);
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `function handle(s: string | undefined) {
  if (s != null) console.log(s.length);
}`,
    },
  ],
  invalid: [
    {
      filename: TEST_FILENAME,
      code: `function process(n: number | null) {
  if (n) console.log(n.toFixed(2));
}`,
      errors: [{ messageId: "truthinessNullNarrowing" }],
    },
    {
      filename: TEST_FILENAME,
      code: `function handle(s: string | null) {
  if (s) console.log(s.length);
}`,
      errors: [{ messageId: "truthinessNullNarrowing" }],
    },
    {
      filename: TEST_FILENAME,
      code: `function process(n: number | null) {
  n && console.log(n.toFixed(2));
}`,
      errors: [{ messageId: "truthinessNullNarrowing" }],
    },
    {
      filename: TEST_FILENAME,
      code: `function handle(val: "" | null) {
  if (val) console.log(val);
}`,
      errors: [{ messageId: "truthinessNullNarrowing" }],
    },
    {
      filename: TEST_FILENAME,
      code: `function handle(flag: boolean | null) {
  if (flag) console.log(flag);
}`,
      errors: [{ messageId: "truthinessNullNarrowing" }],
    },
    {
      filename: TEST_FILENAME,
      code: `function handle(s: string | undefined) {
  if (s) console.log(s.length);
}`,
      errors: [{ messageId: "truthinessNullNarrowing" }],
    },
    {
      filename: TEST_FILENAME,
      code: `function handle(s: string | undefined) {
  s && console.log(s.length);
}`,
      errors: [{ messageId: "truthinessNullNarrowing" }],
    },
    {
      filename: TEST_FILENAME,
      code: `function handle(n: number | null) {
  n || console.log("default");
}`,
      errors: [{ messageId: "truthinessNullNarrowing" }],
    },
    {
      filename: TEST_FILENAME,
      code: `function handle(s: string | undefined) {
  s || console.log("default");
}`,
      errors: [{ messageId: "truthinessNullNarrowing" }],
    },
  ],
});
