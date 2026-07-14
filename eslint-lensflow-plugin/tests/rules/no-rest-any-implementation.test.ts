import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-rest-any-implementation.js";

ruleTester.run("no-rest-any-implementation", rule, {
  valid: [
    `function helper(...args: any[]) {
      return args;
    }`,
    `function create(arg: string): A;
function create(arg1: string, arg2: number): B;
function create(...args: (string | number)[]) {
  return null as any;
}`,
    `function parse(x: string): number;
function parse(x: number): string;
function parse(x: string | number) {
  return typeof x === "string" ? parseInt(x) : String(x);
}`,
    `function create(arg: string): A;
function create(arg1: string, arg2: number): B;
function create(...args: ReadonlyArray<string | number>) {
  return null as any;
}`,
    `declare function parse(x: string): number;
declare function parse(x: number): string;
function parse(x: string | number) {
  return typeof x === "string" ? parseInt(x) : String(x);
}`,
  ],
  invalid: [
    {
      code: `function create(arg: string): A;
function create(arg1: string, arg2: number): B;
function create(...args: any[]) {
  return null;
}`,
      errors: [{ messageId: "restAnyImplementation" }],
    },
    {
      code: `function process(x: string): void;
function process(x: number): void;
function process(...args: any[]) {
  console.log(args);
}`,
      errors: [{ messageId: "restAnyImplementation" }],
    },
    {
      code: `function multi(a: string): void;
function multi(a: string, b: number): void;
function multi(...args: [any, any?]) {
  console.log(args);
}`,
      errors: [{ messageId: "restAnyImplementation" }],
    },
    {
      code: `function create(arg: string): A;
function create(arg1: string, arg2: number): B;
function create(...args: ReadonlyArray<any>) {
  return null;
}`,
      errors: [{ messageId: "restAnyImplementation" }],
    },
    {
      code: `function process(x: string): void;
function process(x: number): void;
function process(...args: Array<any>) {
  console.log(args);
}`,
      errors: [{ messageId: "restAnyImplementation" }],
    },
    {
      code: `declare function handle(x: string): void;
declare function handle(x: number): void;
function handle(...args: any[]) {
  console.log(args);
}`,
      errors: [{ messageId: "restAnyImplementation" }],
    },
  ],
});
