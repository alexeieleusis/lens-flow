import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/prefer-constraint-over-runtime-guard.js";

ruleTester.run("prefer-constraint-over-runtime-guard", rule, {
  valid: [
    // Correct: generic constraint instead of runtime guard
    `function process<T extends { id: string }>(x: T): string {
      return x.id.toUpperCase();
    }`,
    // Correct: properly typed parameter, no any
    `function process(x: { id: string }): string {
      return x.id.toUpperCase();
    }`,
    // Valid: any param but no runtime guard
    `function handle(x: any) {
      console.log(x);
    }`,
    // Valid: any param with typeof but no property access
    `function check(x: any) {
      if (typeof x !== "object") throw new Error("bad");
    }`,
    // Valid: any param with property access but no typeof/instanceof guard
    `function extract(x: any) {
      const v = x.value;
      return v;
    }`,
    // Valid: arrow function with proper typing
    `const fn = (x: { id: string }) => x.id.toUpperCase();`,
  ],
  invalid: [
    // Antipattern from spec: typeof guard + property access
    {
      code: `function process(x: any) {
  if (typeof x !== "object" || !x.id) throw new Error("bad");
  return x.id.toUpperCase();
}`,
      errors: [{ messageId: "preferConstraint" }],
    },
    // Arrow function variant
    {
      code: `const process = (x: any) => {
  if (typeof x !== "object") throw new Error("bad");
  return x.id.toUpperCase();
};`,
      errors: [{ messageId: "preferConstraint" }],
    },
    // instanceof guard + property access
    {
      code: `function handle(data: any) {
  if (!(data instanceof Date)) return null;
  return data.getFullYear();
}`,
      errors: [{ messageId: "preferConstraint" }],
    },
    // FunctionExpression variant
    {
      code: `const fn = function(x: any) {
  if (typeof x !== "string" || !x.length) return;
  return x.trim();
};`,
      errors: [{ messageId: "preferConstraint" }],
    },
    // Defaulted any parameter (AssignmentPattern)
    {
      code: `function process(x: any = {}) {
  if (typeof x !== "object") throw new Error("bad");
  return x.id.toUpperCase();
}`,
      errors: [{ messageId: "preferConstraint" }],
    },
  ],
});
