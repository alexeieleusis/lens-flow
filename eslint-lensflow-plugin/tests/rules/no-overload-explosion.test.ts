import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-overload-explosion.js";

ruleTester.run("no-overload-explosion", rule, {
  valid: [
    `function render(tag: "div"): HTMLDivElement;
function render(tag: "span"): HTMLSpanElement;
function render(tag: "p"): HTMLParagraphElement;
function render(tag: "input"): HTMLInputElement;
function render(tag: "button"): HTMLButtonElement;
function render(tag: string): HTMLElement {
  return document.createElement(tag);
}`,
    `type TagOptions =
  | { tag: "div" }
  | { tag: "span"; class: string }
  | { tag: "input"; type: "text" | "password" };

function render(opts: TagOptions): HTMLElement {
  return document.createElement(opts.tag);
}`,
    `function parse(input: string): number;
function parse(input: boolean): boolean;
function parse(input: unknown): unknown {
  return input;
}`,
    `declare function foo(x: number): string;
declare function foo(x: string): string;
declare function foo(x: boolean): string;
declare function foo(x: unknown): string;`,
    {
      code: `function render(tag: "div"): HTMLDivElement;
function render(tag: "span"): HTMLSpanElement;
function render(tag: "p"): HTMLParagraphElement;
function render(tag: "input"): HTMLInputElement;
function render(tag: "button"): HTMLButtonElement;
function render(tag: "a"): HTMLAnchorElement;
function render(tag: string): HTMLElement {
  return document.createElement(tag);
}`,
      options: [{ maxOverloads: 6 }],
    },
  ],
  invalid: [
    {
      code: `function render(tag: "div"): HTMLDivElement;
function render(tag: "span"): HTMLSpanElement;
function render(tag: "p"): HTMLParagraphElement;
function render(tag: "input"): HTMLInputElement;
function render(tag: "button"): HTMLButtonElement;
function render(tag: "a"): HTMLAnchorElement;
function render(tag: string): HTMLElement {
  return document.createElement(tag);
}`,
      errors: [{ messageId: "tooManyOverloads" }],
    },
    {
      code: `declare function parse(s: string): number;
declare function parse(n: number): number;
declare function parse(b: boolean): number;
declare function parse(d: Date): number;
declare function parse(o: object): number;
declare function parse(x: unknown): number;`,
      errors: [{ messageId: "tooManyOverloads" }],
    },
    {
      code: `function f(a: 1): void;
function f(a: 2): void;
function f(a: 3): void;
function f(a: 4): void;
function f(a: 5): void;
function f(a: 6): void;
function f(a: number): void {}`,
      errors: [{ messageId: "tooManyOverloads" }],
    },
    {
      code: `function parse(input: string): number;
function parse(input: number): number;
function parse(input: boolean): boolean;
function parse(input: unknown): unknown {
  return input;
}`,
      options: [{ maxOverloads: 2 }],
      errors: [{ messageId: "tooManyOverloads" }],
    },
  ],
});
