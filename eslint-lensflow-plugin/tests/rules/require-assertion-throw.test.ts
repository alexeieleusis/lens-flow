import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/require-assertion-throw.js";

ruleTester.run("require-assertion-throw", rule, {
  valid: [
    `function assertString(x: unknown): asserts x is string {
      if (typeof x !== "string") throw new TypeError("string expected");
    }`,
    `function assertNumber(x: unknown): asserts x is number {
      if (typeof x !== "number") throw new Error("expected number");
    }`,
    `const assertDefined = (x: unknown): asserts x is nonnull => {
      if (x === null || x === undefined) throw new Error("undefined");
    };`,
    `function assertString(x: unknown): asserts x is string {
      assertNonNull(x);
    }`,
    `function regularFunction(x: string): string {
      return x;
    }`,
    `function typeGuard(x: unknown): x is string {
      return typeof x === "string";
    }`,
  ],
  invalid: [
    {
      code: `function assertString(x: unknown): asserts x is string {
      }`,
      errors: [{ messageId: "missingThrow" }],
    },
    {
      code: `function assertNumber(x: unknown): asserts x is number {
        console.log("checked");
      }`,
      errors: [{ messageId: "missingThrow" }],
    },
    {
      code: `const assertDefined = (x: unknown): asserts x is nonnull => {
        console.log(x);
      };`,
      errors: [{ messageId: "missingThrow" }],
    },
    {
      code: `const assertString = (x: unknown): asserts x is string => x`,
      errors: [{ messageId: "missingThrow" }],
    },
  ],
});
