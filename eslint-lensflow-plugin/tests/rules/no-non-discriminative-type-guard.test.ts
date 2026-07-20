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
    // Arrow function with block body — discriminative property
    {
      filename: TEST_FILENAME,
      code: `interface A { id: number; foo: string }
interface B { id: number; bar: string }
const isA = (x: A | B): x is A => { return "foo" in x; };`,
    },
    // Template literal property name — discriminative
    {
      filename: TEST_FILENAME,
      code: `interface Cat { name: string; meow(): void }
interface Dog { name: string; bark(): void }
function isCat(a: Cat | Dog): a is Cat { return \`meow\` in a; }`,
    },
    // Union with 3+ members — discriminative property
    {
      filename: TEST_FILENAME,
      code: `interface A { id: number; x: string }
interface B { id: number; y: string }
interface C { id: number; z: string }
function isA(v: A | B | C): v is A { return "x" in v; }`,
    },
    // Valid `in` check outside type guard — no type predicate return type
    {
      filename: TEST_FILENAME,
      code: `interface A { id: number }
interface B { id: number }
function hasId(v: A | B): boolean { return "id" in v; }`,
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
    // Arrow function with block body — non-discriminative property
    {
      filename: TEST_FILENAME,
      code: `interface A { id: number; foo: string }
interface B { id: number; bar: string }
const isA = (x: A | B): x is A => { return "id" in x; };`,
      errors: [{ messageId: "nonDiscriminative" }],
    },
    // Union with 3+ members — non-discriminative (property on all three)
    {
      filename: TEST_FILENAME,
      code: `interface A { id: number; x: string }
interface B { id: number; y: string }
interface C { id: number; z: string }
function isA(v: A | B | C): v is A { return "id" in v; }`,
      errors: [{ messageId: "nonDiscriminative" }],
    },
  ],
});
