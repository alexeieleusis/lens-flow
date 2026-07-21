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
    `type QuotedKeyValid =
      | { "kind": "a"; x: number }
      | { "kind": "b"; y: string };`,
    `type NumericValid =
      | { kind: 1; x: number }
      | { kind: 2; y: string };`,
    `type BooleanValid =
      | { kind: true; enabled: number }
      | { kind: false; disabled: string };`,
    `function fn(x: { kind: "a" } | { kind: "b" }) {}`,
    `const x: { kind: "a" } | { kind: "b" } = {} as any;`,
    `interface I { field: { kind: "a" } | { kind: "b" }; }`,
    `type WithSubstitution =
      | { kind: \`init_\${string}\`; x: number }
      | { kind: \`init_\${string}\`; y: string };`,
  ],
  invalid: [
    {
      code: `type Bad =
      | { kind: "a"; x: number }
      | { kind: "a"; y: string };`,
      errors: [
        { messageId: "duplicateDiscriminant" },
        { messageId: "duplicateDiscriminant" },
      ],
    },
    {
      code: `type Status =
      | { status: "pending"; time: number }
      | { status: "pending"; retry: boolean }
      | { status: "done"; result: string };`,
      errors: [
        { messageId: "duplicateDiscriminant" },
        { messageId: "duplicateDiscriminant" },
      ],
    },
    {
      code: `type Event =
      | { type: "click"; x: number; y: number }
      | { type: "hover"; x: number; y: number }
      | { type: "click"; target: string };`,
      errors: [
        { messageId: "duplicateDiscriminant" },
        { messageId: "duplicateDiscriminant" },
      ],
    },
    {
      code: `type Action =
      | { type: \`init\`; payload: number }
      | { type: \`init\`; payload: string };`,
      errors: [
        { messageId: "duplicateDiscriminant" },
        { messageId: "duplicateDiscriminant" },
      ],
    },
    {
      code: `type QuotedKeyDup =
      | { "kind": "a"; x: number }
      | { "kind": "a"; y: string };`,
      errors: [
        { messageId: "duplicateDiscriminant" },
        { messageId: "duplicateDiscriminant" },
      ],
    },
    {
      code: `type NumericDup =
      | { kind: 1; x: number }
      | { kind: 1; y: string };`,
      errors: [
        { messageId: "duplicateDiscriminant" },
        { messageId: "duplicateDiscriminant" },
      ],
    },
    {
      code: `type BooleanDup =
      | { kind: true; enabled: number }
      | { kind: true; disabled: string };`,
      errors: [
        { messageId: "duplicateDiscriminant" },
        { messageId: "duplicateDiscriminant" },
      ],
    },
    {
      code: `function fn(): { kind: "a" } | { kind: "a" } { throw new Error(); }`,
      errors: [
        { messageId: "duplicateDiscriminant" },
        { messageId: "duplicateDiscriminant" },
      ],
    },
    {
      code: `function fn(x: { kind: "a" } | { kind: "a" }) {}`,
      errors: [
        { messageId: "duplicateDiscriminant" },
        { messageId: "duplicateDiscriminant" },
      ],
    },
    {
      code: `const x: { kind: "a" } | { kind: "a" } = {} as any;`,
      errors: [
        { messageId: "duplicateDiscriminant" },
        { messageId: "duplicateDiscriminant" },
      ],
    },
    {
      code: `interface I { field: { kind: "a" } | { kind: "a" }; }`,
      errors: [
        { messageId: "duplicateDiscriminant" },
        { messageId: "duplicateDiscriminant" },
      ],
    },
  ],
});
