import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-missing-as-const.js";

ruleTester.run("no-missing-as-const", rule, {
  valid: [
    // Already has `as const`
    `const OPS = { add: "add", sub: "sub" } as const;`,
    // Uses satisfies instead
    `const OPS = { add: "add", sub: "sub" } satisfies Record<string, string>;`,
    // Lowercase variable name — not an uppercase constant
    `const ops = { add: "add", sub: "sub" };`,
    // No string/number literal values
    `const CONFIG = { fn: Math.random };`,
    // Non-const declaration
    `let OPS = { add: "add", sub: "sub" };`,
    // Booleans excluded by design — widening to `boolean` is considered acceptable
    `const FLAGS = { enabled: true, disabled: false };`,
    // Empty object
    `const EMPTY = {};`,
  ],
  invalid: [
    {
      code: `const OPS = { add: "add", sub: "sub" };`,
      errors: [{ messageId: "missingAsConst" }],
    },
    {
      code: `const OPS = { add: "add", sub: "sub" };
type Operation = typeof OPS[keyof typeof OPS];`,
      errors: [{ messageId: "missingAsConst" }],
    },
    {
      code: `const PORTS = { http: 80, https: 443 };`,
      errors: [{ messageId: "missingAsConst" }],
    },
    {
      code: `const MIXED = { label: "test", count: 42 };`,
      errors: [{ messageId: "missingAsConst" }],
    },
  ],
});
