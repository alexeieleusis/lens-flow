import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-unnecessary-variadic-generic.js";

ruleTester.run("no-unnecessary-variadic-generic", rule, {
  valid: [
    // No generic parameter at all — the correct form
    `function sum(arr: number[]): number {
      return arr.reduce((a, b) => a + b, 0);
    }`,
    // Generic with non-array constraint
    `function identity<T extends string>(val: T): T {
      return val.toUpperCase();
    }`,
    // Generic constrained to object
    `function process<T extends { id: number }>(item: T): number {
      return item.id;
    }`,
    // Generic with no constraint
    `function passThrough<T>(val: T): T {
      return val;
    }`,
    // Uses tuple-specific spread operation — generic is necessary
    `function head<T extends unknown[]>(arr: T): T[0] | undefined {
      const [first, ...rest] = arr;
      return first;
    }`,
    // Uses indexed access with numeric literal — generic is necessary
    `function first<T extends string[]>(arr: T): T[0] {
      return arr[0];
    }`,
    // Uses non-simple method (push is not in simpleMethods)
    `function add<T extends number[]>(arr: T): void {
      arr.push(1);
    }`,
    // Arrow function — no generic
    `const sum = (arr: number[]): number => {
      return arr.reduce((a, b) => a + b, 0);
    };`,
  ],
  invalid: [
    // Basic antipattern from spec
    {
      code: `function sum<T extends number[]>(arr: T): number {
        return arr.reduce((a, b) => a + b, 0);
      }`,
      errors: [{ messageId: "unnecessaryGeneric" }],
    },
    // unknown[] constraint with forEach
    {
      code: `function logAll<T extends unknown[]>(items: T): void {
        items.forEach(console.log);
      }`,
      errors: [{ messageId: "unnecessaryGeneric" }],
    },
    // any[] constraint with map
    {
      code: `function transform<T extends any[]>(data: T): unknown[] {
        return data.map(String);
      }`,
      errors: [{ messageId: "unnecessaryGeneric" }],
    },
    // Arrow function with generic array constraint
    {
      code: `const process = <T extends number[]>(arr: T): number[] => {
        return arr.filter(x => x > 0);
      };`,
      errors: [{ messageId: "unnecessaryGeneric" }],
    },
    // Multiple simple method calls
    {
      code: `function stats<T extends number[]>(arr: T): boolean {
        const hasPos = arr.some(x => x > 0);
        const allPos = arr.every(x => x > 0);
        return hasPos && allPos;
      }`,
      errors: [{ messageId: "unnecessaryGeneric" }],
    },
    // Function expression
    {
      code: `const fn = function<T extends string[]>(items: T): string {
        return items.find(x => x.length > 0) || "";
      };`,
      errors: [{ messageId: "unnecessaryGeneric" }],
    },
    // Multiple generics, only U is array-constrained and only simple methods on arr
    {
      code: `function mixed<T, U extends number[]>(key: T, arr: U): number {
        return arr.reduce((a, b) => a + b, 0);
      }`,
      errors: [{ messageId: "unnecessaryGeneric" }],
    },
  ],
});
