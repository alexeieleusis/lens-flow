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
  ],
});
