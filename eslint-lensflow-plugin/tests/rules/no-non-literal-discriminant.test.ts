import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-non-literal-discriminant.js";

ruleTester.run("no-non-literal-discriminant", rule, {
  valid: [
    // All literal discriminant values — proper discriminated union
    `type Good =
      | { kind: "first"; x: number }
      | { kind: "second"; y: string };`,

    // No literal types at all — not a discriminant pattern
    `type Bad =
      | { kind: string; x: number }
      | { kind: string; y: string };`,

    // Three-member union with all literal discriminants
    `type State =
      | { type: "idle" }
      | { type: "loading"; progress: number }
      | { type: "done"; result: string };`,

    // Single type literal — not a union
    `type Single = { kind: string; value: number };`,

    // Different property names — not a shared discriminant
    `type DifferentProps =
      | { kind: "a"; x: number }
      | { status: "a"; y: string };`,

    // Literal discriminant + non-string property
    `type Mixed =
      | { kind: "a"; count: string }
      | { kind: "b"; label: string };`,

    // Quoted literal discriminant — exercises the Literal key branch
    `type Quoted =
      | { "kind": "a"; x: number }
      | { "kind": "b"; y: string };`,
  ],
  invalid: [
    // One member has literal, other has widened string for same property
    {
      code: `type Broken =
        | { kind: "a"; x: number }
        | { kind: string; y: string };`,
      errors: [{ messageId: "nonLiteralDiscriminant" }],
    },
    // Three-member union where one member has widened discriminant
    {
      code: `type Partial =
        | { status: "pending"; time: number }
        | { status: string; retry: boolean }
        | { status: "done"; result: string };`,
      errors: [{ messageId: "nonLiteralDiscriminant" }],
    },
    // Number widened discriminant
    {
      code: `type Code =
        | { code: 200; body: string }
        | { code: number; error: string };`,
      errors: [{ messageId: "nonLiteralDiscriminant" }],
    },
    // Two members with widened discriminant
    {
      code: `type MixedBad =
        | { kind: "first"; x: number }
        | { kind: string; y: string }
        | { kind: string; z: boolean };`,
      errors: [{ messageId: "nonLiteralDiscriminant" }, { messageId: "nonLiteralDiscriminant" }],
    },
    // Quoted key with widened discriminant — exercises the Literal key branch
    {
      code: `type QuotedBroken =
        | { "kind": "a"; x: number }
        | { "kind": string; y: string };`,
      errors: [{ messageId: "nonLiteralDiscriminant" }],
    },
  ],
});
