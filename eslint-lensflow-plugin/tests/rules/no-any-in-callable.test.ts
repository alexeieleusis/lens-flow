import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-any-in-callable.js";

ruleTester.run("no-any-in-callable", rule, {
  valid: [
    `function wrap<T>(x: T): { value: T } { return { value: x }; }`,
    `function wrap(x: string): { value: string } { return { value: x }; }`,
    `const fn = <T>(x: T): T => x;`,
    `type Handler = (req: Request, res: Response) => void;`,
    `const cb = (x: number): number => x * 2;`,
    `declare function external(x: any): any;`,
    `function safe(x: unknown): unknown { return x; }`,
    `function f(x: number = 1) { return x; }`,
    `class C { constructor(private x: string) {} }`,
    `interface I { method(x: string): void }`,
    `type T = { method(x: number): boolean }`,
    // AssignmentPattern - arrow with typed default
    `const fn = (x: string = "hello") => x;`,
    // Interface method with typed default
    `interface I { method(x: number = 42): void }`,
    // Optional parameter with non-any type
    `function f(x?: string) { return x; }`,
    // Rest parameter with non-any type
    `function f(...args: string[]) { return args; }`,
    // Callable signature type
    `type Fn = (x: string) => number;`,
    // Constructor signature type
    `type Ctor = new (x: string) => object;`,
    // TSConstructorType
    `type CtorType = new (name: string) => { name: string };`,
    // Multiple params - all non-any
    `function f(a: string, b: number, c?: boolean) { return a; }`,
    // Union without any
    `function f(x: string | number): string | number { return x as any; }`,
    // Intersection type without any
    `function f(x: string & { toString(): void }) { return x; }`,
  ],
  invalid: [
    {
      code: `function wrap(x: any): any { return { value: x }; }`,
      errors: [
        { messageId: "anyParam" },
        { messageId: "anyReturn" },
      ],
    },
    {
      code: `function process(data: any) { console.log(data); }`,
      errors: [{ messageId: "anyParam" }],
    },
    {
      code: `const fn = (x: any): any => x;`,
      errors: [
        { messageId: "anyParam" },
        { messageId: "anyReturn" },
      ],
    },
    {
      code: `type Wrap = (x: any) => any;`,
      errors: [
        { messageId: "anyParam" },
        { messageId: "anyReturn" },
      ],
    },
    {
      code: `function identity(x: any) { return x; }`,
      errors: [{ messageId: "anyParam" }],
    },
    {
      code: `function f(x: any = 1) { return x; }`,
      errors: [{ messageId: "anyParam" }],
    },
    {
      code: `class C { constructor(private x: any) {} }`,
      errors: [{ messageId: "anyParam" }],
    },
    {
      code: `interface I { method(x: any): any }`,
      errors: [
        { messageId: "anyParam" },
        { messageId: "anyReturn" },
      ],
    },
    {
      code: `type T = { handle(data: any): void }`,
      errors: [{ messageId: "anyParam" }],
    },
    // AssignmentPattern - arrow with any default
    {
      code: `const fn = (x: any = "default") => x;`,
      errors: [{ messageId: "anyParam" }],
    },
    // Interface method with any default
    {
      code: `interface I { method(x: any = 42): void }`,
      errors: [{ messageId: "anyParam" }],
    },
    // Optional parameter with any
    {
      code: `function f(x?: any) { return x; }`,
      errors: [{ messageId: "anyParam" }],
    },
    // Rest parameter with any
    {
      code: `function f(...args: any) { return args; }`,
      errors: [{ messageId: "anyParam" }],
    },
    // Callable signature with any
    {
      code: `type Fn = (x: any) => any;`,
      errors: [
        { messageId: "anyParam" },
        { messageId: "anyReturn" },
      ],
    },
    // Constructor signature type with any
    {
      code: `type Ctor = new (x: any) => any;`,
      errors: [
        { messageId: "anyParam" },
        { messageId: "anyReturn" },
      ],
    },
    // Multiple params with any
    {
      code: `function f(a: any, b: number): any { return a; }`,
      errors: [
        { messageId: "anyParam" },
        { messageId: "anyReturn" },
      ],
    },
    // Union-wrapped any in parameter
    {
      code: `function f(x: any | string) {}`,
      errors: [{ messageId: "anyParam" }],
    },
    // Union-wrapped any in return type
    {
      code: `function f(x: string): any | number { return x; }`,
      errors: [{ messageId: "anyReturn" }],
    },
    // Union-wrapped any in both parameter and return
    {
      code: `function f(x: any | string): any | number { return x; }`,
      errors: [
        { messageId: "anyParam" },
        { messageId: "anyReturn" },
      ],
    },
    // Intersection-wrapped any
    {
      code: `function f(x: any & { toString(): void }) { return x; }`,
      errors: [{ messageId: "anyParam" }],
    },
    // Array of any
    {
      code: `function f(x: any[]) { return x; }`,
      errors: [{ messageId: "anyParam" }],
    },
  ],
});
