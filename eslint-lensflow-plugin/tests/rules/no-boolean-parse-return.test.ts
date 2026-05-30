import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-boolean-parse-return.js";

ruleTester.run("no-boolean-parse-return", rule, {
  valid: [
    `function parseAge(raw: string): Result<number, ParseError> {
      const n = parseInt(raw);
      if (n <= 0 || n > 150) return err({ kind: "OutOfRange", value: n });
      return ok(n);
    }`,
    `function parseAge(raw: string): number {
      return parseInt(raw);
    }`,
    `function getName(): string {
      return "test";
    }`,
    `function parseAge(): Result<number, { kind: "OutOfRange"; value: number }> {
      return ok(42);
    }`,
  ],
  invalid: [
    {
      code: `function parseAge(raw: string): boolean {
        const n = parseInt(raw);
        return n > 0 && n < 150;
      }`,
      errors: [{ messageId: "booleanParseReturn" }],
    },
    {
      code: String.raw`function validateEmail(email: string): boolean {
        return /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email);
      }`,
      errors: [{ messageId: "booleanParseReturn" }],
    },
    {
      code: `const fn = function checkPassword(pwd: string): boolean { return pwd.length >= 8; };`,
      errors: [{ messageId: "booleanParseReturn" }],
    },
    {
      code: `function parseAndValidateData(input: unknown): boolean {
        return typeof input === "object" && input !== null;
      }`,
      errors: [{ messageId: "booleanParseReturn" }],
    },
  ],
});
