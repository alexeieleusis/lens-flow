import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-double-assertion-escape.js";

ruleTester.run("no-double-assertion-escape", rule, {
  valid: [
    `const raw = fetchSomething();
    const validated = validateUser(raw);
    if (validated.ok) {
      const user = validated.value;
    }`,
    `const value = data as string;`,
  ],
  invalid: [
    {
      code: `const raw = fetchSomething();
      const user = raw as unknown as User;`,
      errors: [{ messageId: "doubleAssertionEscape" }],
    },
    {
      code: `const x = getValue() as unknown as SomeType;`,
      errors: [{ messageId: "doubleAssertionEscape" }],
    },
  ],
});
