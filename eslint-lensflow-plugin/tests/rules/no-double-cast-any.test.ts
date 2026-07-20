import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-double-cast-any.js";

ruleTester.run("no-double-cast-any", rule, {
  valid: [
    // Single cast to any — only one TSAsExpression, no nested pattern
    `const x = someValue as any;`,
    // intermediate is unknown, not any
    `const x = value as unknown as T;`,
    // Double cast without any
    `const x = value as string as unknown;`,
    // Single cast to specific type
    `const x = value as string;`,
    // Non-null assertion around a single cast
    `const x = (value as T)!;`,
  ],
  invalid: [
    // Basic: simple identifier double-cast through any
    {
      code: `const x = value as any as T;`,
      errors: [{ messageId: "doubleCastAny" }],
    },
    // Basic: reverse order — any as outermost
    {
      code: `const x = value as T as any;`,
      errors: [{ messageId: "doubleCastAny" }],
    },
    // Member expression base
    {
      code: `const x = obj.prop as any as T;`,
      errors: [{ messageId: "doubleCastAny" }],
    },
    // Function call base
    {
      code: `const x = fn() as any as T;`,
      errors: [{ messageId: "doubleCastAny" }],
    },
    // Computed member access base
    {
      code: `const x = arr[0] as any as T;`,
      errors: [{ messageId: "doubleCastAny" }],
    },
    // Object literal base
    {
      code: `const x = { a: 1 } as any as string;`,
      errors: [{ messageId: "doubleCastAny" }],
    },
    // Array literal base
    {
      code: `const x = [1, 2, 3] as any as number[];`,
      errors: [{ messageId: "doubleCastAny" }],
    },
    // Parenthesized expression base
    {
      code: `const x = (a + b) as any as T;`,
      errors: [{ messageId: "doubleCastAny" }],
    },
    // Triple cast: outer as U wraps (x as any as T), inner double-cast still fires
    {
      code: `const x = value as any as T as U;`,
      errors: [{ messageId: "doubleCastAny" }],
    },
    // Non-null assertion wrapping — inner double-cast is still detected
    {
      code: `const x = (value as any as T)!;`,
      errors: [{ messageId: "doubleCastAny" }],
    },
  ],
});
