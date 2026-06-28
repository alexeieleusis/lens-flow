import path from "node:path";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/no-mixed-instanceof-discriminant.js";

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

ruleTester.run("no-mixed-instanceof-discriminant", rule, {
  valid: [
    // All plain object types with literal discriminant — proper discriminated union
    {
      filename: TEST_FILENAME,
      code: `type Event =
        | { kind: "click"; x: number; y: number }
        | { kind: "scroll"; top: number };`,
    },
    // All class types — consistent instanceof narrowing
    {
      filename: TEST_FILENAME,
      code: `class ClickEvent { x: number; y: number }
class ScrollEvent { top: number }
type Event = ClickEvent | ScrollEvent;`,
    },
    // Single union member — not a mix
    {
      filename: TEST_FILENAME,
      code: `type Single = { kind: "only"; value: number };`,
    },
    // Class type with another class type — no plain object literal
    {
      filename: TEST_FILENAME,
      code: `class A { a: number }
class B { b: string }
type Pair = A | B;`,
    },
  ],
  invalid: [
    // Class + plain object literal — mixed narrowing strategy
    {
      filename: TEST_FILENAME,
      code: `class ClickEvent {
  x: number;
  y: number;
}
type Event = ClickEvent | { kind: "scroll"; top: number };`,
      errors: [{ messageId: "mixed" }],
    },
    // Two plain objects with discriminant + one class
    {
      filename: TEST_FILENAME,
      code: `class ResizeEvent {
  width: number;
  height: number;
}
type UIEvent =
  | ResizeEvent
  | { kind: "click"; x: number }
  | { kind: "hover"; y: number };`,
      errors: [{ messageId: "mixed" }],
    },
    // Class + boolean literal discriminant — mixed narrowing strategy
    {
      filename: TEST_FILENAME,
      code: `class ClickEvent {}
type Event = ClickEvent | { kind: true; x: number };`,
      errors: [{ messageId: "mixed" }],
    },
    // Type reference to plain object + class — mixed narrowing strategy
    {
      filename: TEST_FILENAME,
      code: `class ClickEvent {}
type ScrollShape = { kind: "scroll"; top: number };
type Event = ClickEvent | ScrollShape;`,
      errors: [{ messageId: "mixed" }],
    },
    // Parenthesized type literal + class — TSParenthesizedType must be unwrapped
    {
      filename: TEST_FILENAME,
      code: `class ClickEvent { x: number }
type Event = ClickEvent | ({ kind: "scroll"; top: number });`,
      errors: [{ messageId: "mixed" }],
    },
  ],
});
