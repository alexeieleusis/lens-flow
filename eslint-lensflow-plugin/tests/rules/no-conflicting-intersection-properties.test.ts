import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-conflicting-intersection-properties.js";

ruleTester.run("no-conflicting-intersection-properties", rule, {
  valid: [
    `type Good = { x: string } & { y: number };`,
    `type Same = { x: string } & { x: string };`,
    `type NoConflict = { a: boolean } & { b: boolean };`,
    `type Mixed = { x: string } & { y: string };`,
  ],
  invalid: [
    {
      code: `type Bad = { x: string } & { x: number };`,
      errors: [{ messageId: "conflict" }],
    },
    {
      code: `type Conflicting = { a: boolean } & { a: string };`,
      errors: [{ messageId: "conflict" }],
    },
    {
      code: `type Multi = { x: string } & { x: number } & { x: boolean };`,
      errors: [{ messageId: "conflict" }],
    },
    {
      code: `type TwoProps = { x: string } & { y: number } & { x: number };`,
      errors: [{ messageId: "conflict" }],
    },
  ],
});
