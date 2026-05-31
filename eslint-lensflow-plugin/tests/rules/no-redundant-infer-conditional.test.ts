import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-redundant-infer-conditional.js";

ruleTester.run("no-redundant-infer-conditional", rule, {
  valid: [
    `type StringOrNumber = string | number;`,
    `type ElementType<T> = T extends Array<infer U> ? U : never;`,
    `type Lower<T> = T extends string | number ? string : never;`,
    `type StringOrNumber<T> = T extends string | number ? T : unknown;`,
  ],
  invalid: [
    {
      code: `type StringOrNumber<T> = T extends string | number ? T : never;`,
      errors: [{ messageId: "redundantConditional" }],
    },
    {
      code: `type OnlyGreetings<T> = T extends "hello" | "world" ? T : never;`,
      errors: [{ messageId: "redundantConditional" }],
    },
  ],
});
