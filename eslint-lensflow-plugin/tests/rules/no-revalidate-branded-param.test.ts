import path from "node:path";
import { fileURLToPath } from "node:url";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/no-revalidate-branded-param.js";

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

ruleTester.run("no-revalidate-branded-param", rule, {
  valid: [
    {
      filename: TEST_FILENAME,
      code: `declare const emailBrand: unique symbol;
type Email = string & { readonly [emailBrand]: unique symbol };

function sendEmail(to: Email) {
  console.log(\`Sending to \${to}\`);
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `declare const phoneBrand: unique symbol;
type Phone = string & { readonly [phoneBrand]: unique symbol };

function callNumber(phone: Phone) {
  console.log(\`Calling \${phone}\`);
  return true;
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `function logMessage(msg: string) {
  if (!/^[a-z]+$/.test(msg)) {
    throw new Error("Invalid");
  }
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `declare const emailBrand: unique symbol;
type Email = string & { readonly [emailBrand]: unique symbol };

function sendEmail(to: Email) {
  const inner = (to: string) => {
    if (!/^[a-z]+$/.test(to)) {
      throw new Error("inner validation");
    }
  };
  inner(to);
}`,
    },
  ],
  invalid: [
    {
      filename: TEST_FILENAME,
      code: `declare const emailBrand: unique symbol;
type Email = string & { readonly [emailBrand]: unique symbol };

function sendEmail(to: Email) {
  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(to)) {
    throw new Error("never happens");
  }
  console.log(\`Sending to \${to}\`);
}`,
      errors: [{ messageId: "regexTest" }],
    },
    {
      filename: TEST_FILENAME,
      code: `declare const phoneBrand: unique symbol;
type Phone = string & { readonly [phoneBrand]: unique symbol };

const handler = (phone: Phone) => {
  if (phone.length > 0) {
    console.log(phone);
  }
};`,
      errors: [{ messageId: "lengthCheck" }],
    },
  ],
});
