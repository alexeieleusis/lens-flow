import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/require-union-discriminant.js";

ruleTester.run("require-union-discriminant", rule, {
  valid: [
    // Proper discriminated union with literal-typed discriminant
    `type Shape =
      | { kind: "circle"; x: number; y: number; radius: number }
      | { kind: "rect"; x: number; y: number; width: number; height: number };`,

    // Numeric literal discriminant
    `type Response =
      | { code: 200; body: string }
      | { code: 404; error: string }
      | { code: 500; details: unknown };`,

    // Boolean literal discriminant
    `type Toggle =
      | { flag: true; on: string }
      | { flag: false; off: string };`,

    // Single type literal — not a union
    `type Single = { x: number; y: number };`,

    // Only one type literal in the union (the other is a primitive)
    `type MaybePoint = { x: number; y: number } | null;`,

    // One member has a literal-typed property (only one needed to pass)
    `type Partial =
      | { kind: "active"; x: number }
      | { status: string; y: string };`,

    // Quoted string-literal property keys
    `type Shape =
      | { "kind": "circle"; radius: number }
      | { "kind": "rect"; width: number };`,

    // Known limitation: type alias members are skipped.
    // The rule only inspects TSTypeLiteral nodes directly and cannot
    // resolve TSTypeReference nodes (e.g., `type A = { x: string }; type U = A | B`).
    // Such unions pass silently because zero TSTypeLiteral members are found (< 2 threshold).
    `type Circle = { x: number };
    type Rect = { y: number };
    type Shape = Circle | Rect;`,
  ],
  invalid: [
    // No literal-typed discriminant — all widened or primitive types
    {
      code: `type Shape = { x: number; y: number; radius: number } | { x: number; y: number; width: number; height: number };`,
      errors: [{ messageId: "missingDiscriminant" }],
    },
    // Three-member union with no literal discriminant
    {
      code: `type State =
        | { loading: boolean; progress: number }
        | { loaded: boolean; data: string }
        | { errored: boolean; message: string };`,
      errors: [{ messageId: "missingDiscriminant" }],
    },
    // All widened string types — no literal types at all
    {
      code: `type NoDiscriminant =
        | { kind: string; x: number }
        | { kind: string; y: string };`,
      errors: [{ messageId: "missingDiscriminant" }],
    },
    // Object types with only primitive properties, no literal types
    {
      code: `type Config =
        | { host: string; port: number }
        | { host: string; path: string };`,
      errors: [{ messageId: "missingDiscriminant" }],
    },
  ],
});
