import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-any-array-parameter.js";

ruleTester.run("no-any-array-parameter", rule, {
  valid: [
    // Correct pattern: generic with constraints
    `function firstItem<T>(items: readonly T[]): T | undefined {
  return items[0];
}`,
    // unknown[] is safe
    `function firstElement(arr: unknown[]) {
  const first = arr[0];
  if (typeof first === "string" || typeof first === "number") {
    return first.toString();
  }
  throw new Error("Invalid element");
}`,
    // Generic function is exempt
    `function processItems<T>(items: T[]): T[] {
  return items.filter((x) => x !== null);
}`,
    // Specific typed array is fine
    `const fn = (x: string[]) => x.join(",");`,
    // Function type with specific array type is fine
    `type Handler = (data: number[]) => void;`,
    // Return type is not any
    `function getItems(items: string[]): string[] {
  return items;
}`,
    // Generic with return type
    `function identity<T>(x: T): T {
  return x;
}`,
    // No type annotations at all
    `function noAnnotations(x) {
  return x;
}`,
    // Array<string> is fine
    `function join(items: Array<string>): string {
  return items.join(",");
}`,
    // ReadonlyArray<number> is fine
    `function sum(arr: ReadonlyArray<number>): number {
  return arr.reduce((a, b) => a + b, 0);
}`,
  ],
  invalid: [
    // Antipattern from spec: any[] param and any return
    {
      code: `function firstItem(items: any[]): any {
  return items[0];
}`,
      errors: [
        { messageId: "anyParam" },
        { messageId: "anyReturn" },
      ],
    },
    // any[] in arrow function parameter
    {
      code: `const process = (items: any[]) => {
  return items.map(String);
};`,
      errors: [{ messageId: "anyParam" }],
    },
    // any[] in named function expression
    {
      code: `const obj = { fn: function foo(items: any[]) { return items; } };`,
      errors: [{ messageId: "anyParam" }],
    },
    // any[] in function type
    {
      code: `type Handler = (data: any[]) => void;`,
      errors: [{ messageId: "anyParam" }],
    },
    // Mixed params: one any[] among others
    {
      code: `function handle(a: string, b: any[], c: number) {
  return b;
}`,
      errors: [{ messageId: "anyParam" }],
    },
    // readonly any[] should also be flagged
    {
      code: `function safe(arr: readonly any[]) {
  return arr;
}`,
      errors: [{ messageId: "anyParam" }],
    },
    // Return type any
    {
      code: `function compute(): any {
  return {};
}`,
      errors: [{ messageId: "anyReturn" }],
    },
    // Tuple with any
    {
      code: `function pair(x: [any, string], y: number): void {}`,
      errors: [{ messageId: "anyParam" }],
    },
    // any[] in declare function
    {
      code: `declare function loadItems(items: any[]): void;`,
      errors: [{ messageId: "anyParam" }],
    },
    // Multiple any[] params
    {
      code: `function merge(a: any[], b: any[]): any[] {
  return [...a, ...b];
}`,
      errors: [
        { messageId: "anyParam" },
        { messageId: "anyParam" },
      ],
    },
    // any return with any[] param
    {
      code: `function getData(items: any[]): any {
  return items;
}`,
      errors: [
        { messageId: "anyParam" },
        { messageId: "anyReturn" },
      ],
    },
    // Array<any> should be flagged
    {
      code: `function process(items: Array<any>): void {}`,
      errors: [{ messageId: "anyParam" }],
    },
    // ReadonlyArray<any> should be flagged
    {
      code: `function safe(arr: ReadonlyArray<any>): void {}`,
      errors: [{ messageId: "anyParam" }],
    },
    // Array<any> in arrow function
    {
      code: `const fn = (x: Array<any>) => x;`,
      errors: [{ messageId: "anyParam" }],
    },
    // Array<any> in function type
    {
      code: `type Handler = (data: ReadonlyArray<any>) => void;`,
      errors: [{ messageId: "anyParam" }],
    },
    // Plain `any` parameter should be flagged
    {
      code: `function handle(data: any): void {}`,
      errors: [{ messageId: "anyParam" }],
    },
    // Plain `any` in arrow function
    {
      code: `const fn = (x: any) => x;`,
      errors: [{ messageId: "anyParam" }],
    },
    // Plain `any` in function type
    {
      code: `type Callback = (arg: any) => void;`,
      errors: [{ messageId: "anyParam" }],
    },
    // Multiple plain `any` params
    {
      code: `function merge(a: any, b: any): void {}`,
      errors: [
        { messageId: "anyParam" },
        { messageId: "anyParam" },
      ],
    },
    // Mixed: plain `any` alongside typed param
    {
      code: `function process(label: string, value: any): void {}`,
      errors: [{ messageId: "anyParam" }],
    },
    // Readonly<ReadonlyArray<any>> — nested typeArguments should be checked
    {
      code: `function deep(x: Readonly<ReadonlyArray<any>>): void {}`,
      errors: [{ messageId: "anyParam" }],
    },
    // readonly Array<any> — typeOperator wrapping Array<any>
    {
      code: `function wrap(x: readonly Array<any>): void {}`,
      errors: [{ messageId: "anyParam" }],
    },
  ],
});
