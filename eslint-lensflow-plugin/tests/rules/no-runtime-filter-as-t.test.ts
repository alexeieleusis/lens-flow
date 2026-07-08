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
  ],
});
