import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-redundant-overload-signature.js";

ruleTester.run("no-redundant-overload-signature", rule, {
  valid: [
    // Single declaration — no overloads at all
    `function add(a: number, b: number): number {
      return a + b;
    }`,
    // Overload narrows the parameter type — not redundant
    `function parse(s: "1" | "2"): number;
    function parse(s: string): number {
      return parseInt(s, 10);
    }`,
    // Overload narrows the return type — not redundant
    `function get(): "hello";
    function get(): string {
      return "hello";
    }`,
    // Different number of parameters — not redundant
    `function log(msg: string): void;
    function log(msg: string, meta?: unknown): void {
      console.log(msg, meta);
    }`,
  ],
  invalid: [
    // Identical overload — exactly matches implementation
    {
      code: `function add(a: number, b: number): number;
    function add(a: number, b: number): number {
      return a + b;
    }`,
      errors: [{ messageId: "redundantOverload" }],
    },
    // Identical overload with multiple parameters
    {
      code: `function concat(a: string, b: string, sep: string): string;
    function concat(a: string, b: string, sep: string): string {
      return a + sep + b;
    }`,
      errors: [{ messageId: "redundantOverload" }],
    },
    // Identical overload with no parameters
    {
      code: `function greet(): string;
    function greet(): string {
      return "hello";
    }`,
      errors: [{ messageId: "redundantOverload" }],
    },
    // TSDeclareFunction — declare function with identical implementation
    {
      code: `declare function add(a: number, b: number): number;
    function add(a: number, b: number): number {
      return a + b;
    }`,
      errors: [{ messageId: "redundantOverload" }],
    },
  ],
});
