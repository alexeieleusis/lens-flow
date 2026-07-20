import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/prefer-nullish-coalescing.js";

ruleTester.run("prefer-nullish-coalescing", rule, {
  valid: [
    // Already uses nullish coalescing
    `const count = inputCount ?? 10;`,
    `const name = inputName ?? "Anonymous";`,
    // || with non-literal RHS (not a default-value pattern)
    `const result = a || b;`,
    // Chained boolean logic — should not flag
    `const val = (a || b) || "default";`,
    `const val = a && b || "fallback";`,
  ],
  invalid: [
    {
      code: `const count = inputCount || 10;`,
      errors: [{ messageId: "preferNullishCoalescing" }],
      output: `const count = inputCount ?? 10;`,
    },
    {
      code: `const name = inputName || "Anonymous";`,
      errors: [{ messageId: "preferNullishCoalescing" }],
      output: `const name = inputName ?? "Anonymous";`,
    },
    {
      code: `const flag = isEnabled || true;`,
      errors: [{ messageId: "preferNullishCoalescing" }],
      output: `const flag = isEnabled ?? true;`,
    },
    {
      code: `const val = x || 0;`,
      errors: [{ messageId: "preferNullishCoalescing" }],
      output: `const val = x ?? 0;`,
    },
    {
      code: `const label = config.label || "Untitled";`,
      errors: [{ messageId: "preferNullishCoalescing" }],
      output: `const label = config.label ?? "Untitled";`,
    },
    {
      code: `const val = fetchValue() || 0;`,
      errors: [{ messageId: "preferNullishCoalescing" }],
      output: `const val = fetchValue() ?? 0;`,
    },
  ],
});
