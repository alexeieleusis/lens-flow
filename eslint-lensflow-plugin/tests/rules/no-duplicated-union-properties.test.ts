import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-duplicated-union-properties.js";

ruleTester.run("no-duplicated-union-properties", rule, {
  valid: [
    // No duplicated properties — only discriminant + unique per-member properties
    `type State =
      | { kind: "pending"; progress: number }
      | { kind: "done"; result: string };`,
    // Single member is not a union
    `type Single = { kind: "only"; value: number };`,
    // Same property name but different types across members
    `type Mixed =
      | { kind: "a"; value: string }
      | { kind: "b"; value: number };`,
    // Correct pattern: shared structure extracted via intersection with a common interface
    `interface Saveable { id: string; save(): void; }
type Entity =
  | ({ type: "user" } & Saveable & { name: string })
  | ({ type: "post" } & Saveable & { title: string });`,
    // Intersection-based union member: property repeated across literals in the same arm is NOT a duplicate
    `type IntersectionMember =
      | ({ kind: "a"; id: string } & { id: string; extra: number })
      | { kind: "b"; name: string };`,
    // Intersection members with no cross-arm duplicates
    `type NoCrossDup =
      | ({ kind: "a" } & { extraA: number })
      | ({ kind: "b" } & { extraB: boolean });`,
    // Non-discriminated union with duplicated properties — not reported (no discriminant)
    `type NoDiscriminant =
      | { id: string; name: string }
      | { id: string; value: number };`,
    // Quoted (string-literal) property keys — no duplication across members
    `type QuotedValid =
      | { "kind": "a"; "value": string }
      | { "kind": "b"; "value": number };`,
    // Boolean literal discriminant — no duplication across members
    `type BoolFlag =
      | { flag: true; data: string }
      | { flag: false; error: number };`,
    // TSTypeReference member — silently skipped, should not crash
    `type Foo = string; type Mixed = Foo | { kind: "a"; id: string };`,
    // Property without typeAnnotation (implicit any) — silently skipped, should not crash
    `type ImplicitAny =
      | { kind: "a"; foo }
      | { kind: "b"; bar };`,
  ],
  invalid: [
    // From antipattern: id: string duplicated across both members (save() is a method, not inspected by this rule)
    {
      code: `type Entity =
  | { type: "user"; id: string; name: string; save(): void; }
  | { type: "post"; id: string; title: string; save(): void; };`,
      errors: [{ messageId: "duplicatedProperties" }],
    },
    // One duplicated property (id) across two members
    {
      code: `type Item =
  | { kind: "a"; id: string; extraA: number }
  | { kind: "b"; id: string; extraB: boolean };`,
      errors: [{ messageId: "duplicatedProperties" }],
    },
    // Three members: id: number duplicated in all three, kind is the discriminant
    {
      code: `type Status =
  | { kind: "pending"; id: number; time: Date }
  | { kind: "done"; id: number; result: string }
  | { kind: "failed"; id: number; error: string };`,
      errors: [{ messageId: "duplicatedProperties" }],
    },
   // Intersection-based members: id: number duplicated across both arms
    {
      code: `type IntersectDup =
   | ({ kind: "a" } & { id: number; extraA: string })
   | ({ kind: "b" } & { id: number; extraB: boolean });`,
      errors: [{ messageId: "duplicatedProperties" }],
    },
   // Quoted (string-literal) property keys: "id" duplicated across both members
    {
      code: `type QuotedDup =
    | { "kind": "a"; "id": string; "extraA": number }
    | { "kind": "b"; "id": string; "extraB": boolean };`,
      errors: [{ messageId: "duplicatedProperties" }],
    },
    // Boolean literal discriminant: id duplicated across both members
    {
      code: `type BoolDup =
    | { flag: true; id: string; data: string }
    | { flag: false; id: string; error: number };`,
      errors: [{ messageId: "duplicatedProperties" }],
    },
  ],
});
