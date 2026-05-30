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
  ],
});
