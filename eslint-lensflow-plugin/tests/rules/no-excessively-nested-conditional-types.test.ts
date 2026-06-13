import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-excessively-nested-conditional-types.js";

ruleTester.run("no-excessively-nested-conditional-types", rule, {
  valid: [
    // Single conditional type (depth 1)
    `type Extract<T> = T extends { data: infer U } ? U : never;`,
    // Two levels of nesting (depth 2, equals default maxDepth)
    `type Extract<T> = T extends { data: infer U }
      ? U extends { value: infer V }
        ? V
        : never
      : never;`,
    // Conditional inside a union (depth 2)
    `type Merge<T, U> = T extends object
      ? U extends object
        ? T & U
        : T | U
      : T | U;`,
  ],
  invalid: [
    // Three levels of nesting (depth 3 > default maxDepth 2)
    {
      code: `type DeepExtract<T> = T extends { data: infer U }
  ? U extends { value: infer V }
    ? V extends { result: infer W }
      ? W
      : never
    : never
  : never;`,
      errors: [{ messageId: "excessiveNesting" }],
    },
    // Four levels of nesting (depth 4, reports on root depth 4 and inner depth 3)
    {
      code: `type VeryDeep<T> = T extends { a: infer A }
  ? A extends { b: infer B }
    ? B extends { c: infer C }
      ? C extends { d: infer D }
        ? D
        : never
      : never
    : never
  : never;`,
      errors: [
        { messageId: "excessiveNesting" },
        { messageId: "excessiveNesting" },
      ],
    },
    // Two levels with custom maxDepth option (depth 2 > maxDepth 1)
    {
      code: `type Shallow<T> = T extends { a: infer A }
  ? A extends { b: infer B }
    ? B
    : never
  : never;`,
      options: [{ maxDepth: 1 }],
      errors: [{ messageId: "excessiveNesting" }],
    },
  ],
});
