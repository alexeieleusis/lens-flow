import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-typeof-mutable.js";

ruleTester.run("no-typeof-mutable", rule, {
  valid: [
    `const FLAGS = { enabled: true, verbose: false } as const;
type FlagConfig = typeof FLAGS;`,
    `const CONFIG = { a: 1, b: "hello" } as const;
type T = typeof CONFIG;`,
    `const X = 42 as const;
type Num = typeof X;`,
    // Primitives don't need `as const` — typeof already gives the correct type.
    `const X = 42;
type Num = typeof X;`,
    `const S = "hello";
type Str = typeof S;`,
    `const B = true;
type Bool = typeof B;`,
  ],
  invalid: [
    {
      code: `let FLAGS = { enabled: true, verbose: false };
type FlagConfig = typeof FLAGS;`,
      errors: [{ messageId: "mutableLetVar" }],
    },
    {
      code: `var FLAGS = { enabled: true, verbose: false };
type FlagConfig = typeof FLAGS;`,
      errors: [{ messageId: "mutableLetVar" }],
    },
    {
      code: `const FLAGS = { enabled: true, verbose: false };
type FlagConfig = typeof FLAGS;`,
      errors: [{ messageId: "missingAsConst" }],
    },
    {
      code: `let CONFIG = { a: 1, b: "hello" };
type T = typeof CONFIG;
CONFIG = { a: 2 };`,
      errors: [{ messageId: "mutableLetVar" }],
    },
  ],
});
