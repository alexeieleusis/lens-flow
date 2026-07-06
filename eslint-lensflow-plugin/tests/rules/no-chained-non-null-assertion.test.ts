import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-chained-non-null-assertion.js";

ruleTester.run("no-chained-non-null-assertion", rule, {
  valid: [
    `const name = user!.name;`,
    `const val = user?.address?.city;`,
    `const a = x!.foo;
const b = y!.bar;`,
    `const zip = user?.address?.city?.postalCode;`,
  ],
  invalid: [
    {
      code: `const zip = user!.address!.city!.postalCode!;`,
      errors: [{ messageId: "chainedNonNull" }],
    },
    {
      code: `const val = obj!.a!.b;`,
      errors: [{ messageId: "chainedNonNull" }],
    },
    {
      code: `const x = arr!.length!;`,
      errors: [{ messageId: "chainedNonNull" }],
    },
    {
      code: `const x = a!.b.c!;`,
      errors: [{ messageId: "chainedNonNull" }],
    },
  ],
});
