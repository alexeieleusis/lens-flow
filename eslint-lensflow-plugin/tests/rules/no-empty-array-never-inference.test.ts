import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-empty-array-never-inference.js";

ruleTester.run("no-empty-array-never-inference", rule, {
  valid: [
    `const items: string[] = [];`,
    `const items: number[] = [];
items.push(1);`,
    `const items = [1];`,
    `const items: any[] = [];`,
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
    {
      code: `let data = [];`,
      errors: [{ messageId: "emptyArrayNoType" }],
    },
  ],
});
