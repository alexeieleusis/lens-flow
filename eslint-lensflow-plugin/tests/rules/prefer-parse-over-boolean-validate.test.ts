import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/prefer-parse-over-boolean-validate.js";

ruleTester.run("prefer-parse-over-boolean-validate", rule, {
  valid: [
    // Parser returning refined type — the correct pattern
    `function parseEmail(s: string): Email | null {
      if (/^.+@.+.+$/.test(s)) return s as Email;
      return null;
    }`,
    // Boolean return but name doesn't match validation pattern
    `function getEmailStatus(s: string): boolean {
      return /.+@.+/.test(s);
    }`,
    // Name matches pattern but returns non-boolean
    `function isValidEmail(s: string): string | null {
      return /.+@....+/.test(s) ? s : null;
    }`,
    // Boolean return with validation name but no validation logic in body
    `function isEnabled(): boolean {
      return this.flag;
    }`,
    // Arrow function that returns a refined type
    `const parseEmail = (s: string): Email | null => {
      return /.+@....+/.test(s) ? s as Email : null;
    };`,
    // Boolean return but lowercase name doesn't match /^is[A-Z]/ pattern
    `function islowercase(s: string): boolean {
      return /.+@.+/.test(s);
    }`,
    // Nested function with .test() — inner scope should not trigger the rule
    `function isValidData(data: unknown): boolean {
      const inner = (s: string) => /.+/.test(s);
      return true;
    }`,
  ],
  invalid: [
    // Classic antipattern: boolean validator with .test()
    {
      code: `function isValidEmail(s: string): boolean {
        return /.+@.+.+/.test(s);
      }`,
      errors: [{ messageId: "preferParse" }],
    },
    // validate* prefix with .test()
    {
      code: `function validateInput(value: string): boolean {
        return /^[a-z]+$/.test(value);
      }`,
      errors: [{ messageId: "preferParse" }],
    },
    // check* prefix with typeof check
    {
      code: `function checkValid(data: unknown): boolean {
        return typeof data === "string" && data.length > 0;
      }`,
      errors: [{ messageId: "preferParse" }],
    },
    // Arrow function assigned to variable matching pattern
    {
      code: String.raw`const isValidPhone = (s: string): boolean => {
        return /^\d{10}$/.test(s);
      };`,
      errors: [{ messageId: "preferParse" }],
    },
    // FunctionExpression as method-like usage
    {
      code: `const obj = {
      validateName: function(name: string): boolean {
        return /^[A-Z]/.test(name);
      },
    };`,
      errors: [{ messageId: "preferParse" }],
    },
    // Quoted string-literal property key
    {
      code: `const obj = {
      "isValidEmail": function(s: string): boolean {
        return /.+@.+/ .test(s);
      },
    };`,
      errors: [{ messageId: "preferParse" }],
    },
    // Shorthand method syntax inside object literal
    {
      code: `const obj = {
      isValidEmail(s: string): boolean {
        return /.+@.+.+/.test(s);
      },
    };`,
      errors: [{ messageId: "preferParse" }],
    },
  ],
});
