import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-any-boundary.js";

ruleTester.run("no-any-boundary", rule, {
  valid: [
    `const api: unknown = await fetch("/api").then(r => r.json());`,
    `type State =
      | { kind: "pending" }
      | { kind: "complete" };`,
    `const data = JSON.parse(input);`,
    `function process(value: unknown): string { return String(value); }`,
    `const result = fetchData() as ApiResponse;`,
    `const items: string[] = ["a", "b"];`,
  ],
  invalid: [
    {
      code: `const api = fetch("/api").then(r => r.json()) as any;`,
      errors: [{ messageId: "anyInAsExpression" }],
    },
    {
      code: `const data: any = JSON.parse(input);`,
      errors: [{ messageId: "anyInVarAnnotation" }],
    },
    {
      code: `function handleExternal(data: any) { return data; }`,
      errors: [{ messageId: "anyInFunctionType" }],
    },
    {
      code: `function f(...args: any) { return args; }`,
      errors: [{ messageId: "anyInFunctionType" }],
    },
    {
      code: `function parseResponse(): any { return result; }`,
      errors: [{ messageId: "anyInFunctionType" }],
    },
    {
      code: `const handler = (payload: any) => payload.value;`,
      errors: [{ messageId: "anyInFunctionType" }],
    },
    {
      code: `const x: any = someValue as any;`,
      errors: [
        { messageId: "anyInVarAnnotation" },
        { messageId: "anyInAsExpression" },
      ],
    },
    {
      code: `const { a }: any = value;`,
      errors: [{ messageId: "anyInVarAnnotation" }],
    },
    {
      code: `const [ a ]: any = value;`,
      errors: [{ messageId: "anyInVarAnnotation" }],
    },
    {
      code: `let { x, y }: any = obj;`,
      errors: [{ messageId: "anyInVarAnnotation" }],
    },
    {
      code: `const handler = (payload: any = {}) => payload.value;`,
      errors: [{ messageId: "anyInFunctionType" }],
    },
    {
      code: `function handle({ x }: any) { return x; }`,
      errors: [{ messageId: "anyInFunctionType" }],
    },
    {
      code: `const fn = ([ x ]: any) => x;`,
      errors: [{ messageId: "anyInFunctionType" }],
    },
    {
      code: `function handle({ x }: any = {}) { return x; }`,
      errors: [{ messageId: "anyInFunctionType" }],
    },
    {
      code: `type Fn = (x: any) => void;`,
      errors: [{ messageId: "anyInFunctionType" }],
    },
    {
      code: `type Fn = (x: string) => any;`,
      errors: [{ messageId: "anyInFunctionType" }],
    },
    {
      code: `type Fn = (x: any) => any;`,
      errors: [
        { messageId: "anyInFunctionType" },
        { messageId: "anyInFunctionType" },
      ],
    },
    {
      code: `declare function f(x: any): void;`,
      errors: [{ messageId: "anyInFunctionType" }],
    },
    {
      code: `declare function f(x: string): any;`,
      errors: [{ messageId: "anyInFunctionType" }],
    },
    {
      code: `declare function f(x: any): any;`,
      errors: [
        { messageId: "anyInFunctionType" },
        { messageId: "anyInFunctionType" },
      ],
    },
    {
      code: `const handler = (x: any = 1) => x;`,
      errors: [{ messageId: "anyInFunctionType" }],
    },
    {
      code: `function handler(x: any = 1) { return x; }`,
      errors: [{ messageId: "anyInFunctionType" }],
    },
    {
      code: `class C { constructor(private x: any) {} }`,
      errors: [{ messageId: "anyInFunctionType" }],
    },
    {
      code: `const { x }: any = obj;`,
      errors: [{ messageId: "anyInVarAnnotation" }],
    },
    {
      code: `const [ x ]: any = arr;`,
      errors: [{ messageId: "anyInVarAnnotation" }],
    },
    {
      code: `let { a, b }: any = obj;`,
      errors: [{ messageId: "anyInVarAnnotation" }],
    },
    {
      code: `const { a: { b } }: any = obj;`,
      errors: [{ messageId: "anyInVarAnnotation" }],
    },
  ],
});
