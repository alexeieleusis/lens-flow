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
  ],
  invalid: [
    // From antipattern: id: string and save(): void duplicated across both members
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
  ],
});
