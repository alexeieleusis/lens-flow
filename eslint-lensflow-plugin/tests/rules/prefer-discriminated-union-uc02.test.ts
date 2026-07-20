import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/prefer-discriminated-union-uc02.js";

ruleTester.run("prefer-discriminated-union-uc02", rule, {
  valid: [
    // Discriminated union — proper narrowing
    `type Widget =
      | { status: "idle" }
      | { status: "loading"; progress: number }
      | { status: "ready"; value: string }
      | { status: "error"; message: string };`,
    // Single literal in union with non-literal — not the antipattern
    `type State = { kind: "active" | undefined };`,
    // Only one literal member — not enough to trigger
    `type Config = { mode: "strict" };`,
    // Union of wide types, not literals
    `type Data = { value: string | number };`,
    // Interface with boolean flags (different rule)
    `interface Fine {
      isPending: boolean;
      isComplete: boolean;
    }`,
    // Inline union with only one literal member
    `type Single = { tag: "a" | string };`,
    // TSQualifiedName — unresolvable namespace (alias not in scope) — no false positive
    `type Widget = { status: NS.Status };`,
  ],
  invalid: [
    // Antipattern: type alias reference with literal union
    {
      code: `type Status = "idle" | "loading" | "ready" | "error";
type Widget = { status: Status; value: string };`,
      errors: [{ messageId: "literalUnionField" }],
    },
    // Antipattern: inline literal union
    {
      code: `type Widget = { status: "idle" | "loading" | "ready" };`,
      errors: [{ messageId: "literalUnionField" }],
    },
    // Antipattern: interface with literal union field
    {
      code: `interface Payment {
        state: "pending" | "completed" | "failed";
        amount: number;
      }`,
      errors: [{ messageId: "literalUnionField" }],
    },
    // Antipattern: numeric literal union
    {
      code: `type Request = { statusCode: 200 | 404 | 500 };`,
      errors: [{ messageId: "literalUnionField" }],
    },
    // Antipattern: exactly 2 literal members
    {
      code: `type Toggle = { mode: "on" | "off" };`,
      errors: [{ messageId: "literalUnionField" }],
    },
    // Antipattern: TSQualifiedName — namespaced type alias reference resolves to literal union
    {
      code: `type Status = "idle" | "loading" | "ready";
type Widget = { status: NS.Status };`,
      errors: [{ messageId: "literalUnionField" }],
    },
    // Antipattern: multi-level type alias chain
    {
      code: `type A = B;
type B = "x" | "y";
type X = { status: A };`,
      errors: [{ messageId: "literalUnionField" }],
    },
    // Antipattern: quoted string-literal property key (Literal key branch)
    {
      code: `type X = { "status": "a" | "b" };`,
      errors: [{ messageId: "literalUnionField" }],
    },
  ],
});
