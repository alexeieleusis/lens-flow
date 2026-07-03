import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-spread-readonly-workaround.js";

ruleTester.run("no-spread-readonly-workaround", rule, {
  valid: [
    // Passing readonly array directly — no spread needed
    `function sum(numbers: readonly number[]): number {
  return numbers.reduce((a, b) => a + b, 0);
}
const readonlyNumbers: readonly number[] = [1, 2, 3];
sum(readonlyNumbers);`,
    // Spreading a mutable array is fine
    `function sum(numbers: Array<number>): number {
  return numbers.reduce((a, b) => a + b, 0);
}
const mutableNumbers: number[] = [1, 2, 3];
sum([...mutableNumbers]);`,
    // Array expression with no spread
    `function sum(numbers: Array<number>): number {
  return numbers.reduce((a, b) => a + b, 0);
}
const readonlyNumbers: readonly number[] = [1, 2, 3];
sum([1, 2, 3]);`,
    // Multiple spread elements — not exactly one
    `function merge(a: Array<number>): number {
  return a[0];
}
const readonlyNumbers: readonly number[] = [1, 2, 3];
const other: readonly number[] = [4, 5];
merge([...readonlyNumbers, ...other]);`,
  ],
  invalid: [
    // The canonical antipattern from the spec
    {
      code: `function sum(numbers: Array<number>): number {
  return numbers.reduce((a, b) => a + b, 0);
}
const readonlyNumbers: readonly number[] = [1, 2, 3];
sum([...readonlyNumbers]);`,
      errors: [{ messageId: "spreadReadonlyArray" }],
    },
    // Using ReadonlyArray<T> form
    {
      code: `function concat(arr: Array<string>): string {
  return arr.join("");
}
const items: ReadonlyArray<string> = ["a", "b"];
concat([...items]);`,
      errors: [{ messageId: "spreadReadonlyArray" }],
    },
    // TSNonNullExpression wrapper: [...arr!]
    {
      code: `function sum(numbers: Array<number>): number {
  return numbers.reduce((a, b) => a + b, 0);
}
const arr: readonly number[] = [1];
sum([...arr!]);`,
      errors: [{ messageId: "spreadReadonlyArray" }],
    },
    // ChainExpression wrapper: [...obj?.items]
    {
      code: `function sum(numbers: Array<number>): number {
  return numbers.reduce((a, b) => a + b, 0);
}
const obj: { items?: readonly number[] } = {};
if (obj.items) sum([...obj?.items]);`,
      errors: [{ messageId: "spreadReadonlyArray" }],
    },
    // MemberExpression: [...obj.readonlyItems]
    {
      code: `function sum(numbers: Array<number>): number {
  return numbers.reduce((a, b) => a + b, 0);
}
const obj: { readonlyItems: readonly number[] } = { readonlyItems: [1] };
sum([...obj.readonlyItems]);`,
      errors: [{ messageId: "spreadReadonlyArray" }],
    },
    // Readonly array as function parameter
    {
      code: `function helper(arr: Array<number>): number {
  return arr[0];
}
function process(arr: readonly number[]) {
  return helper([...arr]);
}`,
      errors: [{ messageId: "spreadReadonlyArray" }],
    },
  ],
});
