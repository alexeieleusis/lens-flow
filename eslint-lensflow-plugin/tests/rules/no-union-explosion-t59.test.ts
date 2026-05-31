import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-union-explosion-t59.js";

ruleTester.run("no-union-explosion-t59", rule, {
  valid: [
    `type Shape =
      | { kind: "circle"; radius: number }
      | { kind: "rect"; w: number; h: number }
      | { kind: "triangle"; base: number };`,
    `type Small =
      | { type: "a"; x: string }
      | { type: "b"; y: number };`,
    `type Mixed =
      | { kind: "foo"; val: string }
      | string
      | { kind: "bar"; val: number };`,
  ],
  invalid: [
    {
      code: `type Widget =
        | { type: "text"; label: string }
        | { type: "number"; min: number; max: number }
        | { type: "date"; default: string }
        | { type: "select"; options: string[] }
        | { type: "checkbox"; checked: boolean };`,
      errors: [{ messageId: "tooManyVariants" }],
    },
    {
      code: `type Event =
        | { type: "click"; x: number; y: number }
        | { type: "hover"; x: number; y: number }
        | { type: "press"; duration: number }
        | { type: "release" }
        | { type: "move"; dx: number; dy: number }
        | { type: "scroll"; delta: number };`,
      errors: [{ messageId: "tooManyVariants" }],
    },
  ],
});
