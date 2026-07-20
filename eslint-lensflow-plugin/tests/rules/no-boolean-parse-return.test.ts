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
    `const validateEmail = (email: string): Result<string, Error> => ok(email);`,
    `const parseAge = (raw: string): number => parseInt(raw);`,
    `const fn = (x: string): boolean => x.length > 0;`,
    `const checkFormat = (input: string): Result<boolean, Error> => ok(true);`,
    `const parseAge = (raw: string): Result<number, Error> => {
      const helper = (x: string): boolean => x.length > 0;
      return helper(raw) ? ok(1) : err(new Error("invalid"));
    };`,
    // Names that share a prefix but are NOT parse/validate/check functions
    `const checking = (box: boolean): boolean => box;`,
    `const parser = (config: unknown): boolean => typeof config === "object";`,
    `const validated = (count: number): boolean => count > 0;`,
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
    {
      code: `const validateEmail = (email: string): boolean => /\S+@\S+/.test(email);`,
      errors: [{ messageId: "booleanParseReturn" }],
    },
    {
      code: `const parseAge = (raw: string): boolean => {
        const n = parseInt(raw);
        return n > 0 && n < 150;
      };`,
      errors: [{ messageId: "booleanParseReturn" }],
    },
    {
      code: `const checkPassword = function(pwd: string): boolean { return pwd.length >= 8; };`,
      errors: [{ messageId: "booleanParseReturn" }],
    },
    {
      code: `const parseAndValidate = (input: unknown): boolean => typeof input === "object";`,
      errors: [{ messageId: "booleanParseReturn" }],
    },
    {
      code: `const parseInput = (raw: string): boolean => raw.length > 0;`,
      errors: [{ messageId: "booleanParseReturn" }],
    },
    {
      code: `const checkFormat = (input: string): boolean => {
        return typeof input === "string" && input.trim().length > 0;
      };`,
      errors: [{ messageId: "booleanParseReturn" }],
    },
    {
      code: `const validateName = function(name: string): boolean { return name.length >= 2; };`,
      errors: [{ messageId: "booleanParseReturn" }],
    },
    {
      code: `const parseConfig = function(cfg: unknown): boolean { return typeof cfg === "object"; };`,
      errors: [{ messageId: "booleanParseReturn" }],
    },
    {
      code: `const parseAge = (raw: string): boolean => {
        const helper = (x: string): boolean => x.length > 0;
        return helper(raw);
      };`,
      errors: [{ messageId: "booleanParseReturn" }],
    },
  ],
});
