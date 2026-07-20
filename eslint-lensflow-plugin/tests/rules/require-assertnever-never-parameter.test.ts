import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/require-assertnever-never-parameter.js";

ruleTester.run("require-assertnever-never-parameter", rule, {
  valid: [
    `function assertNever(x: never): never {
      throw new Error("unreachable");
    }`,
    `const assertExhaustive = (x: never): never => {
      throw new Error("unreachable");
    };`,
    `function assertNever(x: never) {
      throw new Error("unreachable");
    }`,
    `function notAssertNever(x: any) {
      return x;
    }`,
    `const someOtherFn = (x: any) => x;`,
    // Case-sensitive: AssertNever does NOT match /^assertNever$/
    `function AssertNever(x: any) {
      return x;
    }`,
    `const ASSERTNEVER = (x: any) => x;`,
    // Parameterless assertNever is safe — rule returns early when params is empty
    `function assertNever() {
      throw new Error("unreachable");
    }`,
    // Untyped parameter — typeAnn is undefined, condition is falsy, no report
    `function assertNever(x) {
      throw new Error("unreachable");
    }`,
  ],
  invalid: [
    {
      code: `function assertNever(x: any) {
        console.log("unreachable");
      }`,
      errors: [{ messageId: "badParamType" }],
    },
    {
      code: `function assertNever(x: unknown) {
        throw new Error("unreachable");
      }`,
      errors: [{ messageId: "badParamType" }],
    },
    {
      code: `const assertExhaustive = (x: string) => {
        throw new Error("unreachable");
      };`,
      errors: [{ messageId: "badParamType" }],
    },
    {
      code: `const assertNever = function (x: number) {
        throw new Error("unreachable");
      };`,
      errors: [{ messageId: "badParamType" }],
    },
  ],
});
