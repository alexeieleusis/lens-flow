import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-intersected-function-types.js";

ruleTester.run("no-intersected-function-types", rule, {
  valid: [
    `type Safe = ((x: string) => void) | ((x: number) => void);`,
    `interface Fine {
      handler: (x: string) => void;
    }`,
    `type Single = (x: string) => void;`,
    `type Mixed = ((x: string) => void) & { readonly tag: "handler" };`,
  ],
  invalid: [
    {
      code: `type Bad = ((x: string) => void) & ((x: number) => void);`,
      errors: [{ messageId: "intersectedFunctions" }],
    },
    {
      code: `type Triple = ((x: string) => void) & ((x: number) => void) & ((x: boolean) => void);`,
      errors: [{ messageId: "intersectedFunctions" }],
    },
    {
      code: `type NoParams = (() => void) & (() => number);`,
      errors: [{ messageId: "intersectedFunctions" }],
    },
    {
      code: `type MixedNonFunc = { tag: "a" } & ((x: string) => void) & ((x: number) => void);`,
      errors: [{ messageId: "intersectedFunctions" }],
    },
  ],
});
