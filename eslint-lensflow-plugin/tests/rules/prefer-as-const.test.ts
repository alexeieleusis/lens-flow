import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/prefer-as-const.js";

ruleTester.run("prefer-as-const", rule, {
  valid: [
    `const COLORS = {
  primary: "red",
  secondary: "blue",
} as const;`,
    `const config = { a: 1, b: 2 };`,
    `const x = { a: "hi" } as Readonly<{ a: string }>;`,
    `const x = "hello" as string;`,
  ],
  invalid: [
    {
      code: `const COLORS = {
  primary: "red",
  secondary: "blue",
} as { primary: string; secondary: string };`,
      errors: [{ messageId: "preferAsConst" }],
    },
    {
      code: `const config = { a: 1, b: 2 } as { a: number; b: number };`,
      errors: [{ messageId: "preferAsConst" }],
    },
    {
      code: `const x = {} as {};`,
      errors: [{ messageId: "preferAsConst" }],
    },
  ],
});
