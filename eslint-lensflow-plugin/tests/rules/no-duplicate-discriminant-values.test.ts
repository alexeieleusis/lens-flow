import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-duplicate-discriminant-values.js";

ruleTester.run("no-duplicate-discriminant-values", rule, {
  valid: [
    `type Good =
      | { kind: "a"; x: number }
      | { kind: "b"; y: string };`,
    `type State =
      | { type: "idle" }
      | { type: "loading"; progress: number }
      | { type: "done"; result: string };`,
    `type Single = { kind: "only"; value: number };`,
    `type NotLiteral =
      | { kind: string; x: number }
      | { kind: string; y: string };`,
    `type DifferentProps =
      | { kind: "a"; x: number }
      | { status: "a"; y: string };`,
  ],
  invalid: [
    {
      code: `type Bad =
      | { kind: "a"; x: number }
      | { kind: "a"; y: string };`,
      errors: [{ messageId: "duplicateDiscriminant" }, { messageId: "duplicateDiscriminant" }],
    },
    {
      code: `type Status =
      | { status: "pending"; time: number }
      | { status: "pending"; retry: boolean }
      | { status: "done"; result: string };`,
      errors: [{ messageId: "duplicateDiscriminant" }, { messageId: "duplicateDiscriminant" }],
    },
    {
      code: `type Event =
      | { type: "click"; x: number; y: number }
      | { type: "hover"; x: number; y: number }
      | { type: "click"; target: string };`,
      errors: [{ messageId: "duplicateDiscriminant" }, { messageId: "duplicateDiscriminant" }],
    },
  ],
});
