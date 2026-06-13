import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-nested-discriminated-unions.js";

ruleTester.run("no-nested-discriminated-unions", rule, {
  valid: [
    `type Response =
      | { kind: "ok-list"; items: Item[] }
      | { kind: "ok-item"; item: Item }
      | { kind: "empty" }
      | { kind: "error"; code: number; msg: string };`,
    `type State =
      | { kind: "pending" }
      | { kind: "complete"; value: boolean };`,
    `type Wrapper =
      | { kind: "data"; value: string | null }
      | { kind: "error"; msg: string };`,
    `type Simple = { kind: "a" | "b"; value: number };`,
  ],
  invalid: [
    {
      code: `type Response =
        | { kind: "ok"; data: { kind: "list" | "item"; items?: Item[] } | null }
        | { kind: "error"; code: number; msg: string };`,
      errors: [{ messageId: "nestedDiscriminatedUnion" }],
    },
    {
      code: `type Nested =
        | { kind: "ok"; inner: { kind: "a"; x: number } | { kind: "b"; y: string } }
        | { kind: "err"; code: number };`,
      errors: [{ messageId: "nestedDiscriminatedUnion" }],
    },
    {
      code: `type Deep =
        | { kind: "parent"; child: ({ kind: "left"; val: number } | null) }
        | { kind: "none" };`,
      errors: [{ messageId: "nestedDiscriminatedUnion" }],
    },
  ],
});
