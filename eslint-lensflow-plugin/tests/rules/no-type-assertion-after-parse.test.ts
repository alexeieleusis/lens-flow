import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-type-assertion-after-parse.js";

ruleTester.run("no-type-assertion-after-parse", rule, {
  valid: [
    // Runtime validation instead of type assertion
    `function parseUser(json: unknown): string {
      const raw = JSON.parse(json);
      if (typeof raw !== "object" || raw === null || typeof raw.id !== "string") {
        throw new TypeError("invalid user");
      }
      return raw.id;
    }`,
    // JSON.parse without type assertion is fine
    `const data = JSON.parse(input);
    console.log(data);`,
    // Type assertion on something other than JSON.parse
    `const x = getValue() as { id: string };`,
    // Variable from JSON.parse used without assertion
    `const raw = JSON.parse(input);
    const name = raw.name;`,
    // Assertion on a variable not from JSON.parse
    `const obj = createObj();
    const typed = obj as { id: string };`,
    // Scope shadowing: inner parameter with same name should NOT trigger
    `const raw = JSON.parse(input);
    function inner(raw: { id: string }) {
      const u = raw as { id: string };
    }`,
    // Nested block shadowing
    `const raw = JSON.parse(input);
    {
      const raw = { id: "local" };
      const u = raw as { id: string };
    }`,
  ],
  invalid: [
    // Direct type assertion on JSON.parse
    {
      code: `function parseUser(json: unknown): string {
        const u = JSON.parse(json) as { id: string };
        return u.id;
      }`,
      errors: [{ messageId: "directAssertion" }],
    },
    // Indirect: variable assigned JSON.parse then asserted
    {
      code: `function parseUser(json: unknown): string {
        const raw = JSON.parse(json);
        const u = raw as { id: string };
        return u.id;
      }`,
      errors: [{ messageId: "indirectAssertion" }],
    },
    // Multiple JSON.parse assertions
    {
      code: `const a = JSON.parse(x) as { name: string };
      const b = JSON.parse(y) as { age: number };`,
      errors: [
        { messageId: "directAssertion" },
        { messageId: "directAssertion" },
      ],
    },
    // Assertion with as any
    {
      code: `const data = JSON.parse(input) as any;`,
      errors: [{ messageId: "directAssertion" }],
    },
  ],
});
