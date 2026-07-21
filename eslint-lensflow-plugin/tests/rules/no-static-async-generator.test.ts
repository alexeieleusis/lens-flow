import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-static-async-generator.js";

ruleTester.run("no-static-async-generator", rule, {
  valid: [
    `function staticList(): number[] {
      return [1, 2, 3];
    }`,
    `async function* notStatic(): AsyncGenerator<number> {
      const arr = fetchNumbers();
      for (const x of arr) yield x;
    }`,
    `async function* withComputation(): AsyncGenerator<number> {
      const arr = [1, 2, 3];
      for (const x of arr) yield x * 2;
    }`,
    `async function* tooLarge(): AsyncGenerator<number> {
      const arr = [1, 2, 3, 4, 5, 6];
      for (const x of arr) yield x;
    }`,
    `async function* notPlainYield(): AsyncGenerator<number> {
      const arr = [1, 2, 3];
      for (const x of arr) {
        console.log(x);
        yield x;
      }
    }`,
    `async function* multipleDecls(): AsyncGenerator<number> {
      const arr = [1, 2, 3];
      const other = [4, 5];
      for (const x of arr) yield x;
    }`,
    `function* syncGenerator(): Generator<number> {
      const arr = [1, 2, 3];
      for (const x of arr) yield x;
    }`,
    `async function notGenerator(): Promise<number[]> {
      const arr = [1, 2, 3];
      return arr;
    }`,
    // Object literals are NOT considered "literal nodes" — should be valid
    `async function* withObjectLiterals(): AsyncGenerator<object> {
      const items = [{a: 1}, {b: 2}];
      for (const item of items) yield item;
    }`,
    // Sparse array (elision holes) — null elements should not match
    `async function* withSparseArray(): AsyncGenerator<number> {
      const arr = [1, , 3];
      for (const x of arr) yield x;
    }`,
  ],
  invalid: [
    {
      code: `async function* badStatic(): AsyncGenerator<number> {
        const arr = [1, 2, 3];
        for (const x of arr) yield x;
      }`,
      errors: [{ messageId: "staticAsyncGenerator" }],
    },
    {
      code: `async function* anotherBad(): AsyncGenerator<string> {
        const items = ["a", "b"];
        for (const item of items) yield item;
      }`,
      errors: [{ messageId: "staticAsyncGenerator" }],
    },
    {
      code: `async function* atLimit(): AsyncGenerator<number> {
        const vals = [1, 2, 3, 4, 5];
        for (const v of vals) yield v;
      }`,
      errors: [{ messageId: "staticAsyncGenerator" }],
    },
    {
      code: `const gen = async function* (): AsyncGenerator<number> {
        const nums = [10, 20];
        for (const n of nums) yield n;
      };`,
      errors: [{ messageId: "staticAsyncGenerator" }],
    },
    {
      code: `async function* withStrings(): AsyncGenerator<string> {
        const words = ["hello", "world"];
        for (const w of words) yield w;
      }`,
      errors: [{ messageId: "staticAsyncGenerator" }],
    },
    // Negative numeric literals are considered literal nodes
    {
      code: `async function* withNegativeNumbers(): AsyncGenerator<number> {
        const nums = [-1, -2, -3];
        for (const n of nums) yield n;
      }`,
      errors: [{ messageId: "staticAsyncGenerator" }],
    },
    // Template literals (without expressions) are considered literal nodes
    {
      code:
        "async function* withTemplateLiterals(): AsyncGenerator<string> {\n" +
        "  const strs = ['a', `hello`];\n" +
        "  for (const s of strs) yield s;\n" +
        "}",
      errors: [{ messageId: "staticAsyncGenerator" }],
    },
  ],
});
