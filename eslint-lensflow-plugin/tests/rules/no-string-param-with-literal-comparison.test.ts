import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-string-param-with-literal-comparison.js";

ruleTester.run("no-string-param-with-literal-comparison", rule, {
  valid: [
    // Parameter already uses a literal union type
    `type Mode = "light" | "dark";
function setMode(mode: Mode) {
  if (mode === "dark") { /* ... */ }
}`,
    // No string literal comparisons in the body
    `function greet(name: string) {
  console.log(name);
}`,
    // String parameter compared but no literal string comparison
    `function process(input: string) {
  const len = input.length;
  return len > 0;
}`,
    // Parameter is not typed as string
    `function handle(status: "ok" | "err") {
  if (status === "ok") { /* ... */ }
}`,
    // Arrow function with no literal comparison
    `const fn = (x: string) => x.toUpperCase();`,
    // Only !== comparison (not ===)
    `function check(mode: string) {
  if (mode !== "dark") { /* ... */ }
}`,
  ],
  invalid: [
    // Basic case from antipattern snippet
    {
      code: `function setMode(mode: string) {
  if (mode === "dark") { /* ... */ }
  if (mode === "light") { /* ... */ }
}`,
      errors: [{ messageId: "stringParamWithLiteralComparison" }],
    },
    // Arrow function with literal comparison
    {
      code: `const handleStatus = (status: string) => {
  if (status === "pending") return 1;
  if (status === "done") return 2;
  return 0;
};`,
      errors: [{ messageId: "stringParamWithLiteralComparison" }],
    },
    // Function expression
    {
      code: `const fn = function(type: string) {
  if (type === "a") { }
  if (type === "b") { }
};`,
      errors: [{ messageId: "stringParamWithLiteralComparison" }],
    },
    // Literal on the left side of comparison
    {
      code: `function check(env: string) {
  if ("prod" === env) { /* ... */ }
}`,
      errors: [{ messageId: "stringParamWithLiteralComparison" }],
    },
    // Nested comparisons (inside if blocks)
    {
      code: `function route(action: string) {
  if (action === "create") {
    if (action === "create") {
      console.log("creating");
    }
  }
}`,
      errors: [{ messageId: "stringParamWithLiteralComparison" }],
    },
  ],
});
