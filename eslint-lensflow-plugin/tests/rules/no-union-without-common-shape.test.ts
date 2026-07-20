import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-union-without-common-shape.js";

ruleTester.run("no-union-without-common-shape", rule, {
  valid: [
    `type Good =
      | { type: "ok"; msg: string }
      | { type: "error"; code: number }
      | { type: "loading"; data: never };`,
    `type Single = { a: number; b: string };`,
    `type Mixed = { type: string } | number;`,
    `type WithCommon = { a: string; x: number } | { a: string; y: boolean };`,
    `type QuotedCommon = { "type": "ok"; msg: string } | { "type": "error"; code: number };`,
    `type QuotedMixed = { "msg": string } | number;`,
    `type NearMiss = { type: string; extra: number } | { type: number; other: boolean };`,
  ],
  invalid: [
    {
      code: `type Bad = { msg: string } | { code: number } | { data: unknown };`,
      errors: [{ messageId: "noCommonShape" }],
    },
    {
      code: `type Fragments =
        | { name: string }
        | { age: number };`,
      errors: [{ messageId: "noCommonShape" }],
    },
    {
      code: `type QuotedBad = { "msg": string } | { "code": number } | { "data": unknown };`,
      errors: [{ messageId: "noCommonShape" }],
    },
    {
      code: `type WithMethods = { foo(): void } | { bar(): number };`,
      errors: [{ messageId: "noCommonShape" }],
    },
  ],
});
