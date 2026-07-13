import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-empty-array-never-inference.js";

ruleTester.run("no-empty-array-never-inference", rule, {
  valid: [
    `const items: string[] = [];`,
    `const items: number[] = [];
items.push(1);`,
    `const items = [1];`,
    `const items: any[] = [];`,
    `const items: unknown[] = [];`,
    `const items: readonly string[] = [];`,
    `let data = [];`,
    `var items = [];`,
  ],
  invalid: [
    {
      code: `const items = [];
items.push("hello");`,
      errors: [{ messageId: "emptyArrayNoType" }],
    },
    {
      code: `const list = [];`,
      errors: [{ messageId: "emptyArrayNoType" }],
    },
  ],
});
