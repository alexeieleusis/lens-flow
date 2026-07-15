import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-runtime-filter-as-t.js";

ruleTester.run("no-runtime-filter-as-t", rule, {
  valid: [
    `function filterEven(arr: number[]): number[] {
  return arr.filter(x => x % 2 === 0);
}`,
    `function filterEven<T extends unknown[]>(arr: T): number[] {
  return arr.filter(x => typeof x === "number") as number[];
}`,
    `function findItem<T>(arr: T[], predicate: (x: T) => boolean): T | undefined {
  return arr.find(predicate);
}`,
    `const result = arr.filter(x => x > 0);`,
    `function getFirst<T>(arr: T[]): T {
  return arr[0];
}`,
    // Wrapped return — ternary: the ">" combinator only matches direct children,
    // so an intermediate ConditionalExpression prevents the rule from firing.
    // This is intentional; the rule targets the common direct-return pattern.
    `function conditionalFilter<T extends unknown[]>(arr: T, cond: boolean): T {
  return cond ? arr.filter(x => typeof x === "string") as T : arr;
}`,
    // Wrapped return — logical expression: same reasoning as above.
    `function logicalFilter<T extends unknown[]>(arr: T, fallback: T): T {
  return arr.filter(x => typeof x === "number") as T || fallback;
}`,
    // Nested function: inner arrow has no type params, outer function's generic
    // type is NOT referenced by the cast — no false positive.
    `function processItems<T>(arr: T[]): number[] {
  const helper = () => {
    return arr.filter(x => x != null) as number[];
  };
  return helper();
}`,
    // Nested function: inner arrow shadows outer type param — cast resolves to
    // inner scope, not outer, so no violation.
    `function outer<T>(arr: T[]): T[] {
  const inner = <U>(items: U[]): U[] => {
    return items.filter(x => x != null) as U[];
  };
  return inner(arr);
}`,
  ],
  invalid: [
    {
      code: `function filterEven<T extends unknown[]>(arr: T): T {
  return arr.filter(x => typeof x === 'number' && x % 2 === 0) as T;
}`,
      errors: [{ messageId: "runtimeFilterCastGeneric" }],
    },
    {
      code: `const filterOdd = <T extends unknown[]>(arr: T): T =>
  arr.filter(x => typeof x === "number" && x % 2 !== 0) as T;`,
      errors: [{ messageId: "runtimeFilterCastGeneric" }],
    },
    {
      code: `function extractStrings<T extends unknown[]>(arr: T): T {
  return arr.filter(x => typeof x === "string") as T;
}`,
      errors: [{ messageId: "runtimeFilterCastGeneric" }],
    },
    {
      code: `const filterNumbers = function<T extends unknown[]>(arr: T): T {
  return arr.filter(x => typeof x === "number") as T;
};`,
      errors: [{ messageId: "runtimeFilterCastGeneric" }],
    },
    // Nested function: inner arrow has no type params, outer function's type
    // param is referenced by the cast — should report.
    {
      code: `function processItems<T extends unknown[]>(arr: T): T {
  const helper = () => {
    return arr.filter(x => typeof x === "number") as T;
  };
  return helper();
}`,
      errors: [{ messageId: "runtimeFilterCastGeneric" }],
    },
  ],
});
