import path from "node:path";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/no-never-as-catchall.js";

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

ruleTester.run("no-never-as-catchall", rule, {
  valid: [
    {
      filename: TEST_FILENAME,
      code: `const x: unknown = JSON.parse("{}");`,
    },
    {
      filename: TEST_FILENAME,
      code: `function assertNever(x: never): never {
  throw new Error("Unexpected value: " + x);
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `function handle(status: "ok" | "err") {
  switch (status) {
    case "ok":
      return;
    case "err":
      return;
    default:
      const _: never = status;
      throw new Error("Unexpected: " + _);
  }
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `function check(x: "a" | "b") {
  if (x === "a") return;
  if (x === "b") return;
  const _: never = x;
  throw new Error(_);
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `function handle(x: "a" | "b") {
  if (x === "a") return;
  else {
    const _: never = x;
    throw new Error(_);
  }
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `class Foo {
  constructor(readonly x: never) {}
}`,
    },
  ],
  invalid: [
    {
      filename: TEST_FILENAME,
      code: `const y: never = JSON.parse("{}");`,
      errors: [{ messageId: "neverAsCatchall" }],
    },
    {
      filename: TEST_FILENAME,
      code: `const z: never = "hello";`,
      errors: [{ messageId: "neverAsCatchall" }],
    },
    {
      filename: TEST_FILENAME,
      code: `function greet(): string {
  return "hi";
}
const msg: never = greet();`,
      errors: [{ messageId: "neverAsCatchall" }],
    },
    {
      filename: TEST_FILENAME,
      code: `class Foo {
  constructor(readonly x: never = JSON.parse("{}")) {}
}`,
      errors: [{ messageId: "neverAsCatchall" }],
    },
  ],
});
