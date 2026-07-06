import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/require-assertnever-never-return.js";

ruleTester.run("require-assertnever-never-return", rule, {
  valid: [
    `function assertNever(x: never): never {
      throw new Error("unreachable");
    }`,
    `function assertExhaustive(x: never): never {
      throw new Error("unreachable");
    }`,
    `const assertNever = (x: never): never => {
      throw new Error("unreachable");
    };`,
    `const assertExhaustive = (x: never): never => {
      throw new Error("unreachable");
    };`,
    `function notAssertNever(x: never): void {
      console.log(x);
    }`,
    `function check(x: string): string {
      return x;
    }`,
  ],
  invalid: [
    {
      code: `function assertNever(x: any) {
        console.log("unreachable");
      }`,
      errors: [{ messageId: "missingNeverReturn" }],
    },
    {
      code: `function assertNever(x: never) {
        throw new Error("unreachable");
      }`,
      errors: [{ messageId: "missingNeverReturn" }],
    },
    {
      code: `function assertNever(x: never): void {
        throw new Error("unreachable");
      }`,
      errors: [{ messageId: "wrongReturnType" }],
    },
    {
      code: `function assertExhaustive(x: never): string {
        throw new Error("unreachable");
      }`,
      errors: [{ messageId: "wrongReturnType" }],
    },
    {
      code: `const assertNever = (x: never) => {
        throw new Error("unreachable");
      };`,
      errors: [{ messageId: "missingNeverReturn" }],
    },
    {
      code: `const assertExhaustive = (x: never): void => {
        throw new Error("unreachable");
      };`,
      errors: [{ messageId: "wrongReturnType" }],
    },
    {
      code: `const fn = cb(function assertNever(x: never) {
        throw new Error("unreachable");
      });`,
      errors: [{ messageId: "missingNeverReturn" }],
    },
  ],
});
