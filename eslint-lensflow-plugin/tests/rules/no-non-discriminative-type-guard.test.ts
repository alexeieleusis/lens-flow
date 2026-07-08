import path from "node:path";
import { fileURLToPath } from "node:url";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/no-non-discriminative-type-guard.js";

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
    {
      // Nested non-type-guard function must not suppress outer guard check
      filename: TEST_FILENAME,
      code: `interface Cat { name: string; meow(): void }
interface Dog { name: string; bark(): void }
function isCat(a: Cat | Dog): a is Cat {
  function helper(): boolean {
    return true;
  }
  return "meow" in a;
}`,
    },
    {
      // Nested type guard with discriminating property — both valid
      filename: TEST_FILENAME,
      code: `interface Cat { name: string; meow(): void }
interface Dog { name: string; bark(): void }
interface Bird { name: string; fly(): void }
interface Fish { name: string; swim(): void }
function outer(a: Cat | Dog): a is Cat {
  function inner(b: Bird | Fish): b is Bird {
    return "fly" in b;
  }
  return "meow" in a;
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
    {
      // Regression: nested non-type-guard function must not break outer guard detection
      filename: TEST_FILENAME,
      code: `interface Cat { name: string; meow(): void }
interface Dog { name: string; bark(): void }
function isCat(a: Cat | Dog): a is Cat {
  function helper(): boolean {
    return "meow" in ({} as any);
  }
  return "name" in a;
}`,
      errors: [{ messageId: "nonDiscriminative" }],
    },
    {
      // Regression: nested type guard with own union must not clear outer guard
      filename: TEST_FILENAME,
      code: `interface Cat { name: string; meow(): void }
interface Dog { name: string; bark(): void }
interface Bird { name: string; fly(): void }
interface Fish { name: string; swim(): void }
function outer(a: Cat | Dog): a is Cat {
  function inner(b: Bird | Fish): b is Bird {
    return "name" in b;
  }
  return "name" in a;
}`,
      errors: [{ messageId: "nonDiscriminative" }, { messageId: "nonDiscriminative" }],
    },
  ],
});
