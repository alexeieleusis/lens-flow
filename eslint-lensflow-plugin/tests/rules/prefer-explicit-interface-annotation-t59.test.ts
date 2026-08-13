import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/prefer-explicit-interface-annotation-t59.js";

ruleTester.run("prefer-explicit-interface-annotation-t59", rule, {
  valid: [
    `type Printable = { print(): string };

const x: Printable = { print() { return "hi"; }, secret: 42 };`,
    `const x = { a: 1, b: "two" } satisfies { a: number; b: string };`,
    `const x = { print() { return "hi"; } } satisfies { print(): string };`,
    `namespace TE { export type Printable = { print(): string } }
const x = { print() { return "hi"; }, secret: 42 } satisfies TE.Printable;`,
    `interface Meta { title: string; layout: "centered" | "fullscreen" }
const meta = { title: "Board", layout: "centered" } satisfies Meta;`,
    `interface Printable { print(): string }
declare function someValue(): Printable;
const x = someValue() satisfies Printable;`,
    `interface Base { a: number }
interface Derived extends Base { b: string }
const x = { a: 1, b: "two" } satisfies Derived;`,
    `interface Config { a: number; b: string }
declare const base: { a: number };
const x = { ...base, b: "two" } satisfies Config;`,
  ],
  invalid: [
    {
      code: `type Printable = { print(): string };

const x = { print() { return "hi"; }, secret: 42 } satisfies Printable;`,
      errors: [{ messageId: "preferAnnotation" }],
    },
    {
      code: `interface Handler { handle(): void; }

const h = { handle() {}, extra: true } satisfies Handler;`,
      errors: [{ messageId: "preferAnnotation" }],
    },
    {
      code: `interface Meta { title: string; layout: "centered" | "fullscreen" }
const meta = { title: "Board", layout: "centered", secret: 42 } satisfies Meta;`,
      errors: [{ messageId: "preferAnnotation" }],
    },
  ],
});
