import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-double-assertion.js";

ruleTester.run("no-double-assertion", rule, {
  valid: [
    `const raw: unknown = fetchData();
if (isUser(raw)) {
  // use raw, narrowed to User
}`,
    `const value = x as string;`,
    `const parsed = JSON.parse(data) as Record<string, unknown>;`,
    `const x = value as string as number;`,
  ],
  invalid: [
    {
      code: `const raw: unknown = fetchData();
const user = raw as unknown as User;`,
      errors: [{ messageId: "doubleAssertion" }],
    },
    {
      code: `const data = response as any as MyData;`,
      errors: [{ messageId: "doubleAssertion" }],
    },
    {
      code: `const result = value as unknown as string as number;`,
      errors: [{ messageId: "doubleAssertion" }],
    },
    {
      code: `const x = value as unknown as string;`,
      errors: [{ messageId: "doubleAssertion" }],
    },
  ],
});
