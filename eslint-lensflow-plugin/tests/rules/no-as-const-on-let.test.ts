import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-as-const-on-let.js";

ruleTester.run("no-as-const-on-let", rule, {
  valid: [
    `const apiKey = fetchKey() as const;`,
    `let apiKey: string = fetchKey();`,
    `let count = 0;`,
    `const config = { host: "localhost", port: 3000 } as const;`,
    `var x = 1 as const;`,
    // Regression: `findAsConst` must not escape the initializer subtree via
    // the `parent` pointer and pick up an `as const` from another declaration
    `const a = 1 as const;
let b = 2;`,
    // Regression: `as const` in an unrelated expression statement must not
    // leak into the `let` initializer check via parent traversal
    `process(config as const);
let count = 0;`,
    // `as const` inside arrow function body — not on the let binding itself
    `let f = () => getValue() as const;`,
    // `as const` inside IIFE initializer — belongs to the nested function
    `let x = (() => 1 as const)();`,
    // `as const` inside function expression body — not on the let binding
    `let y = function() { return 2 as const; };`,
  ],
  invalid: [
    {
      code: `let apiKey = fetchKey() as const;`,
      errors: [{ messageId: "asConstOnLet" }],
    },
    {
      code: `let apiKey = "new-key" as const;`,
      errors: [{ messageId: "asConstOnLet" }],
    },
    {
      code: `let config = { host: "localhost", port: 3000 } as const;`,
      errors: [{ messageId: "asConstOnLet" }],
    },
    {
      code: `let a = 1 as const;
let b = 2 as const;`,
      errors: [{ messageId: "asConstOnLet" }, { messageId: "asConstOnLet" }],
    },
    {
      code: `let nested = { inner: "value" as const };`,
      errors: [{ messageId: "asConstOnLet" }],
    },
    // Regression: sibling declarator in the same `let` has `as const` — the
    // walker must stay inside each declarator's init subtree and not escape
    // through `parent` to pick up the sibling's `as const`.
    {
      code: `let a = 1 as const, b = 2;`,
      errors: [{ messageId: "asConstOnLet" }],
    },
  ],
});
