import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/prefer-const-for-literal-binding.js";

ruleTester.run("prefer-const-for-literal-binding", rule, {
  valid: [
    `const dir = "north";`,
    `let count: number = 42;`,
    `let flag: boolean = true;`,
    `const x = 100;`,
    `let name;`,
    `let items = [];`,
    `let config = {};`,
    `const isReady = true;`,
    `let value = null;`,
    // reassigned variables must stay as let
    `for (let i = 0; i < 10; i++) {}`,
    `for (let row = 0; row < n; row++) { for (let col = 0; col < n; col++) {} }`,
    `let count = 0; count++;`,
    `let total = 0; total += 1;`,
    `let x = 0; x = 5;`,
  ],
  invalid: [
    {
      code: `let dir = "north";`,
      output: `const dir = "north";`,
      errors: [{ messageId: "preferConst" }],
    },
    {
      code: `let count = 42;`,
      output: `const count = 42;`,
      errors: [{ messageId: "preferConst" }],
    },
    {
      code: `let flag = true;`,
      output: `const flag = true;`,
      errors: [{ messageId: "preferConst" }],
    },
    {
      code: `
        let status = "pending";
        let retries = 3;
      `,
      output: `
        const status = "pending";
        const retries = 3;
      `,
      errors: [{ messageId: "preferConst" }, { messageId: "preferConst" }],
    },
    {
      code: `let a = 1, b = "two";`,
      output: `const a = 1, b = "two";`,
      errors: [{ messageId: "preferConst" }, { messageId: "preferConst" }],
    },
    {
      // nested scope shadowing — outer count is never reassigned, inner count is a separate binding
      code: `let count = 0; function f() { let count = 5; count++; }`,
      output: `const count = 0; function f() { let count = 5; count++; }`,
      errors: [{ messageId: "preferConst" }],
    },
  ],
});
