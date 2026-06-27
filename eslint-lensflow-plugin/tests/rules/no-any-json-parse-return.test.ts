import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-any-json-parse-return.js";

ruleTester.run("no-any-json-parse-return", rule, {
  valid: [
    `function parse(json: string): { name: string | null } {
      const data = JSON.parse(json);
      return { name: typeof data.name === "string" ? data.name : null };
    }`,
    `const parse = (json: string): unknown => JSON.parse(json);`,
    `function parse(json: string): any {
      return "hello";
    }`,
    `function parse(json: string): Record<string, unknown> {
      return JSON.parse(json);
    }`,
    `type Parser = (input: string) => unknown;`,
    // Nested function with JSON.parse should not trigger the outer function
    `function outer(): any {
      const inner = (): string => JSON.parse("{}");
      return inner();
    }`,
    `function outer(): any {
      function inner() { return JSON.parse("[]"); }
      return 42;
    }`,
    `const outer = (): any => {
      const inner = () => JSON.parse("{}");
      return {};
    }`,
    // Class method with proper return type should not trigger
    `class Parser {
      parse(raw: string): { name: string } {
        return JSON.parse(raw);
      }
    }`,
    // Class method with any return but no JSON.parse should not trigger
    `class Parser {
      parse(raw: string): any {
        return raw;
      }
    }`,
  ],
  invalid: [
    {
      code: `function parse(json: string): any {
        return JSON.parse(json);
      }`,
      errors: [{ messageId: "anyJsonParseReturn" }],
    },
    {
      code: `const parse = (json: string): any => JSON.parse(json);`,
      errors: [{ messageId: "anyJsonParseReturn" }],
    },
    {
      code: `function load(data: string): any {
        const result = JSON.parse(data);
        return result;
      }`,
      errors: [{ messageId: "anyJsonParseReturn" }],
    },
    {
      code: `const fn = function (s: string): any {
        return JSON.parse(s);
      };`,
      errors: [{ messageId: "anyJsonParseReturn" }],
    },
    // Class method with any return and JSON.parse
    {
      code: `class Parser {
        parse(raw: string): any {
          return JSON.parse(raw);
        }
      }`,
      errors: [{ messageId: "anyJsonParseReturn" }],
    },
    // Class method with any return and nested JSON.parse
    {
      code: `class Parser {
        load(data: string): any {
          const result = JSON.parse(data);
          return result;
        }
      }`,
      errors: [{ messageId: "anyJsonParseReturn" }],
    },
    // JSON.parse nested inside try/catch control structure
    {
      code: `function parse(raw: string): any {
        try {
          return JSON.parse(raw);
        } catch { return {}; }
      }`,
      errors: [{ messageId: "anyJsonParseReturn" }],
    },
  ],
});
