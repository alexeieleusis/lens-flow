import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-module-level-mutable-export.js";

ruleTester.run("no-module-level-mutable-export", rule, {
  valid: [
    `export const COUNTER = 0;`,
    `export class Counter {
  #value = 0;
  increment() { this.#value++; }
  get value() { return this.#value; }
}`,
    `const local = 0;`,
    `let local = 0;`,
  ],
  invalid: [
    {
      code: `export let COUNTER = 0;
export function increment() { COUNTER++; }`,
      errors: [{ messageId: "mutableExport" }],
    },
    {
      code: `export var config = { value: 0 };`,
      errors: [{ messageId: "mutableExport" }],
    },
  ],
});
