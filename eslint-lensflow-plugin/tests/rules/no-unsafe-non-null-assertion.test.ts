import path from "node:path";
import { fileURLToPath } from "node:url";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/no-unsafe-non-null-assertion.js";

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

ruleTester.run("no-unsafe-non-null-assertion", rule, {
  valid: [
    {
      filename: TEST_FILENAME,
      code: `function render(name: string) {
  return \`<h1>\${name.toUpperCase()}</h1>\`;
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `function render(name: string | null) {
  if (!name) return "";
  return \`<h1>\${name.toUpperCase()}</h1>\`;
}`,
    },
  ],
  invalid: [
    {
      filename: TEST_FILENAME,
      code: `function render(name: string | null) {
  return \`<h1>\${name!.toUpperCase()}</h1>\`;
}`,
      errors: [{ messageId: "unsafeNonNull" }],
    },
    {
      filename: TEST_FILENAME,
      code: `function getValue(x: number | undefined) {
  return x! * 2;
}`,
      errors: [{ messageId: "unsafeNonNull" }],
    },
    {
      filename: TEST_FILENAME,
      code: `function maybeUse(val: string | null | undefined) {
  return val!.length;
}`,
      errors: [{ messageId: "unsafeNonNull" }],
    },
  ],
});
