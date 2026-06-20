import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-double-cast-any.js";

ruleTester.run("no-double-cast-any", rule, {
  valid: [
    `const data: User = jsonResponse as User;`,
    `const value = someValue as string;`,
    `const safe = (x as unknown) as SomeType;`,
  ],
  invalid: [
    {
      code: `const data: User = jsonResponse as any as User;`,
      errors: [{ messageId: "doubleCastAny" }],
    },
    {
      code: `const result = response.data as any as MyType;`,
      errors: [{ messageId: "doubleCastAny" }],
    },
    {
      code: `const x = (foo as string) as any;`,
      errors: [{ messageId: "doubleCastAny" }],
    },
    {
      code: `const y = (a as string) as any as number;`,
      errors: [{ messageId: "doubleCastAny" }, { messageId: "doubleCastAny" }],
    },
  ],
});
