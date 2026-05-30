import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-any-type-guard-parameter.js";

ruleTester.run("no-any-type-guard-parameter", rule, {
  valid: [
    `function isString(value: unknown): value is string {
      return typeof value === "string";
    }`,
    `function isNumber(value: string | number): value is number {
      return typeof value === "number";
    }`,
    `const x: any = getValue();
    if (typeof x === "string") {
      x.undefinedProp;
    }`,
  ],
  invalid: [
    {
      code: `function isString(value: any): value is string {
        return typeof value === "string";
      }`,
      errors: [{ messageId: "anyTypeGuardParam" }],
    },
    {
      code: `function isNumber(value: any): value is number {
        return typeof value === "number";
      }`,
      errors: [{ messageId: "anyTypeGuardParam" }],
    },
    {
      code: `declare function isArray(value: any): value is any[];`,
      errors: [{ messageId: "anyTypeGuardParam" }],
    },
  ],
});
