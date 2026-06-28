import path from "node:path";
import { fileURLToPath } from "node:url";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/no-narrowing-lost-in-callback.js";

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

ruleTester.run("no-narrowing-lost-in-callback", rule, {
  valid: [
    {
      filename: TEST_FILENAME,
      code: `function render(value: string | null) {
  if (value != null) {
    const v = value;
    setTimeout(() => console.log(v.length), 0);
  }
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `function render(value: string | null) {
  if (value != null) {
    console.log(value.length);
  }
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `function render(value: string | null) {
  if (value != null) {
    const fn = () => console.log(value.length);
  }
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `function render(value: string) {
  if (value != null) {
    setTimeout(() => console.log(value.length), 0);
  }
}`,
    },
  ],
  invalid: [
    {
      filename: TEST_FILENAME,
      code: `function render(value: string | null) {
  if (value != null) {
    setTimeout(() => console.log(value.length), 0);
  }
}`,
      errors: [{ messageId: "narrowingLost" }],
    },
    {
      filename: TEST_FILENAME,
      code: `function render(value: string | null) {
  if (value !== null) {
    Promise.resolve().then(() => console.log(value.length));
  }
}`,
      errors: [{ messageId: "narrowingLost" }],
    },
    {
      filename: TEST_FILENAME,
      code: `function render(value: string | null) {
  if (value !== undefined) {
    setInterval(() => console.log(value.length), 1000);
  }
}`,
      errors: [{ messageId: "narrowingLost" }],
    },
    {
      filename: TEST_FILENAME,
      code: `function render(value: string | null) {
  if (value != null) {
    somePromise.catch((err) => console.log(value.length));
  }
}`,
      errors: [{ messageId: "narrowingLost" }],
    },
  ],
});
