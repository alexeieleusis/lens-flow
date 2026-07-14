import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-excessive-union-members.js";

ruleTester.run("no-excessive-union-members", rule, {
  valid: [
    `type NavigationAction = { kind: "navigate"; path: string } | { kind: "back"; steps: number };`,
    `type DataAction = { kind: "load"; url: string } | { kind: "save"; payload: unknown };
type Action = NavigationAction | DataAction;`,
    `type Status = "idle" | "loading" | "success" | "error" | "retrying";`,
    {
      code: `type Status = "a" | "b" | "c" | "d";`,
      options: [{ maxMembers: 5 }],
    },
  ],
  invalid: [
    {
      code: `type BigUnion = string | number | boolean | null | undefined | bigint | symbol | Foo | Bar | Baz;`,
      options: [{ maxMembers: 5 }],
      errors: [{ messageId: "tooManyMembers" }],
    },
    {
      code: `type Action =
  | { kind: "a1"; data: string }
  | { kind: "a2"; data: string }
  | { kind: "a3"; data: string }
  | { kind: "a4"; data: string }
  | { kind: "a5"; data: string }
  | { kind: "a6"; data: string };`,
      options: [{ maxMembers: 5 }],
      errors: [{ messageId: "tooManyMembers" }],
    },
  ],
});
