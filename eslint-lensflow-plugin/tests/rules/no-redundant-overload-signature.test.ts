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
    // AssignmentPattern — default parameter, different names
    `function foo(x: number = 1): number;
    function foo(y: number = 2): number {
      return y;
    }`,
    // AssignmentPattern — default parameter, same name different default
    `function bar(x: number = 1): number;
    function bar(x: number = 2): number {
      return x;
    }`,
    // RestElement — rest parameter, different names
    `function sum(first: number, ...rest: number[]): number;
    function sum(first: number, ...values: number[]): number {
      return first + values.reduce((a, b) => a + b, 0);
    }`,
    // ObjectPattern — destructured parameter, different types
    `function getConfig({ host }: { host: string }): string;
    function getConfig({ port }: { port: number }): string {
      return String(port);
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
    // Identical overload with default parameter — AssignmentPattern
    {
      code: `function foo(x: number = 1): number;
    function foo(x: number = 1): number {
      return x;
    }`,
      errors: [{ messageId: "redundantOverload" }],
    },
    // Identical overload with rest parameter — RestElement
    {
      code: `function flatten(...items: number[][]): number[];
    function flatten(...items: number[][]): number[] {
      return items.flat();
    }`,
      errors: [{ messageId: "redundantOverload" }],
    },
    // Identical overload with destructured parameter — ObjectPattern
    {
      code: `function getHost({ host }: { host: string }): string;
    function getHost({ host }: { host: string }): string {
      return host;
    }`,
      errors: [{ messageId: "redundantOverload" }],
    },
  ],
});
