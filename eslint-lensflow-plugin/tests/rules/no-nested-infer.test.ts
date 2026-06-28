import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-nested-infer.js";

ruleTester.run("no-nested-infer", rule, {
  valid: [
    // Single-level property access — shallow and clear
    `type Unwrap<T> = T extends { data: infer D } ? D : never;`,
    // Single-level generic — still acceptable
    `type Resolve<T> = T extends Promise<infer V> ? V : T;`,
    // No infer at all
    `type Keys<T> = T extends object ? keyof T : never;`,
  ],
  invalid: [
    // Antipattern from spec: Promise wrapping object with infer inside
    {
      code: `type Deep<T> = T extends { data: Promise<{ value: infer V }> } ? V : never;`,
      errors: [{ messageId: "deeplyNestedInfer" }],
    },
    // Multiple levels of generic nesting with infer
    {
      code: `type Extract<T> = T extends Promise<Array<{ result: infer R }>> ? R : never;`,
      errors: [{ messageId: "deeplyNestedInfer" }],
    },
  ],
});
