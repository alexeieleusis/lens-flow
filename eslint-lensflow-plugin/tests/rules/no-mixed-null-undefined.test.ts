import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-mixed-null-undefined.js";

ruleTester.run("no-mixed-null-undefined", rule, {
  valid: [
    `type ExplicitAbsent = string | null;`,
    `type NotYetProvided = string | undefined;`,
    `type Safe = string | number | boolean;`,
  ],
  invalid: [
    {
      code: `type Confusing = string | null | undefined;`,
      errors: [{ messageId: "mixedNullUndefined" }],
    },
    {
      code: `type Bad = null | undefined;`,
      errors: [{ messageId: "mixedNullUndefined" }],
    },
    {
      code: `type Messy = number | null | undefined | string;`,
      errors: [{ messageId: "mixedNullUndefined" }],
    },
  ],
});
