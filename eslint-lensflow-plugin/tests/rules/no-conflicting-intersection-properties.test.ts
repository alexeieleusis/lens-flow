import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-conflicting-intersection-properties.js";

ruleTester.run("no-conflicting-intersection-properties", rule, {
  valid: [
    `type Good = { x: string } & { y: number };`,
    `type Same = { x: string } & { x: string };`,
    `type NoConflict = { a: boolean } & { b: boolean };`,
    `type Mixed = { x: string } & { y: string };`,
    `type GoodLiteral = { x: 1 } & { x: 1 };`,
    `type QuotedSame = { "x": string } & { "x": string };`,
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
    {
      code: `type BadLiteral = { x: 1 } & { x: 2 };`,
      errors: [{ messageId: "conflict" }],
    },
    {
      code: `type MultiConflict = { x: string } & { y: number } & { x: number } & { y: string };`,
      errors: [{ messageId: "conflict" }],
    },
    {
      code: `type QuotedConflict = { "x": string } & { "x": number };`,
      errors: [{ messageId: "conflict" }],
    },
  ],
});
