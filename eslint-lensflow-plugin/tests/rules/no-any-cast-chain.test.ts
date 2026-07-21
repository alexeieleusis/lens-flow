import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-any-cast-chain.js";

ruleTester.run(
  "no-any-cast-chain (deprecated - use no-double-cast-any)",
  rule,
  {
    valid: [
      `const value = someValue as SomeType;`,
      `const safe = (x as unknown) as SomeType;`,
      `const x = value as any;`,
      `const z = (x as A) as B as C;`,
    ],
    invalid: [
      {
        code: `const bypassed = someValue as any as RequestBuilder;`,
        errors: [{ messageId: "doubleCastAny" }],
      },
      {
        code: `const x = (foo as string) as any;`,
        errors: [{ messageId: "doubleCastAny" }],
      },
    ],
  },
);
