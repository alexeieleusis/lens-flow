import path from "node:path";   
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/require-type-predicate-subtype.js";

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

ruleTester.run("require-type-predicate-subtype", rule, {
  valid: [
    {
      filename: TEST_FILENAME,
      code: `class Animal {
  isDog(): this is Dog { return this instanceof Dog; }
}
class Dog extends Animal {}`,
    },
    {
      filename: TEST_FILENAME,
      code: `interface Base {}
interface Extended extends Base {}
interface Base {
  isExtended(): this is Extended;
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `class Animal {
  isAnimal(): this is Animal { return true; }
}`,
    },
  ],
  invalid: [
    {
      filename: TEST_FILENAME,
      code: `class Animal {
  isString(): this is string { return false; }
}`,
      errors: [{ messageId: "notSubtype" }],
    },
    {
      filename: TEST_FILENAME,
      code: `class Foo {
  isBar(): this is Date { return true; }
}`,
      errors: [{ messageId: "notSubtype" }],
    },
  ],
});
