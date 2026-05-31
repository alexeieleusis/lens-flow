import path from "node:path";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/no-non-discriminative-type-guard.js";

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

ruleTester.run("no-non-discriminative-type-guard", rule, {
  valid: [
    {
      filename: TEST_FILENAME,
      code: `interface Cat { name: string; meow(): void }
interface Dog { name: string; bark(): void }
function isCat(a: Cat | Dog): a is Cat {
  return "meow" in a;
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `interface Cat { name: string; meow(): void }
interface Dog { name: string; bark(): void }
function isDog(a: Cat | Dog): a is Dog {
  return "bark" in a;
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `function isString(x: string | number): x is string {
  return typeof x === "string";
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `interface A { foo: string }
interface B { bar: string }
function isA(x: A | B): x is A {
  return "foo" in x;
}`,
    },
  ],
  invalid: [
    {
      filename: TEST_FILENAME,
      code: `interface Cat { name: string; meow(): void }
interface Dog { name: string; bark(): void }
function isCatWrong(a: Cat | Dog): a is Cat {
  return "name" in a;
}`,
      errors: [{ messageId: "nonDiscriminative" }],
    },
    {
      filename: TEST_FILENAME,
      code: `interface Bird { name: string; fly(): void }
interface Fish { name: string; swim(): void }
function isBird(a: Bird | Fish): a is Bird {
  return "name" in a;
}`,
      errors: [{ messageId: "nonDiscriminative" }],
    },
    {
      filename: TEST_FILENAME,
      code: `interface A { id: number; x: string }
interface B { id: number; y: string }
const check = (v: A | B): v is A => "id" in v;`,
      errors: [{ messageId: "nonDiscriminative" }],
    },
  ],
});
