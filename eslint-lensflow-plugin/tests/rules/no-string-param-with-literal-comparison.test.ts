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
    // Only one literal comparison with minComparisons: 2
    {
      code: `function check(mode: string) {
  if (mode === "dark") { /* ... */ }
}`,
      options: [{ minComparisons: 2 }],
    },
    // Only one distinct literal compared twice
    {
      code: `function route(action: string) {
  if (action === "create") {
    if (action === "create") {
      console.log("creating");
    }
  }
}`,
      options: [{ minComparisons: 2 }],
    },
    // Single != comparison with minComparisons: 2
    {
      code: `function check(mode: string) {
  if (mode !== "dark") { /* ... */ }
}`,
      options: [{ minComparisons: 2 }],
    },
    // Comparison of outer param inside nested callback should not be attributed to outer scope
    `function setMode(mode: string) {
  const handler = (other: number) => {
    if (mode === "dark") { /* ... */ }
  };
}`,
    // Nested function shadows parameter — should NOT report
    `function setMode(mode: string) {
  const inner = (mode: number) => {
    if (mode === 42) { /* ... */ }
  };
}`,
    // Defaulted parameter with no literal comparisons
    `function greet(name: string = "world") {
  console.log(name);
}`,
    // Template literal with expression is not a simple string literal
    `function check(mode: string) {
  if (mode === \`\${"dark"}\`) { /* ... */ }
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
    // !== comparison (now detected)
    {
      code: `function check(mode: string) {
  if (mode !== "dark") { /* ... */ }
}`,
      errors: [{ messageId: "stringParamWithLiteralComparison" }],
    },
    // Loose equality == 
    {
      code: `function process(type: string) {
  if (type == "create") return;
  if (type == "update") return;
}`,
      errors: [{ messageId: "stringParamWithLiteralComparison" }],
    },
    // != operator
    {
      code: `function filter(kind: string) {
  if (kind != "skip") return;
  if (kind != "pass") return;
}`,
      errors: [{ messageId: "stringParamWithLiteralComparison" }],
    },
    // Mixed operators
    {
      code: `function classify(category: string) {
  if (category === "a") return 1;
  if (category !== "b") return 2;
}`,
      errors: [{ messageId: "stringParamWithLiteralComparison" }],
    },
    // Default parameter with string type
    {
      code: `function greet(name: string = "world") {
  if (name === "alice") return "hi alice";
  if (name === "bob") return "hi bob";
  return "hello";
}`,
      errors: [{ messageId: "stringParamWithLiteralComparison" }],
    },
    // Single literal with minComparisons: 1 (default)
    {
      code: `function check(mode: string) {
  if (mode === "dark") { /* ... */ }
}`,
      errors: [{ messageId: "stringParamWithLiteralComparison" }],
    },
    // Multiple distinct literals with minComparisons: 2
    {
      code: `function statusIcon(status: string) {
  if (status === "pending") return "pending";
  if (status === "shipped") return "shipped";
  return "unknown";
}`,
      options: [{ minComparisons: 2 }],
      errors: [{ messageId: "stringParamWithLiteralComparison" }],
    },
    // Nested arrow function param with literal comparisons
    {
      code: `function outer(x: string) {
  const handler = (y: string) => {
    if (y === "a") return true;
    if (y === "b") return false;
  };
}`,
      errors: [{ messageId: "stringParamWithLiteralComparison" }],
    },
    // Template literal without expressions
    {
      code: `function setMode(mode: string) {
  if (mode === \`dark\`) { /* ... */ }
  if (mode === \`light\`) { /* ... */ }
}`,
      errors: [{ messageId: "stringParamWithLiteralComparison" }],
    },
    // Template literal on the left side of comparison
    {
      code: `function check(env: string) {
  if (\`prod\` === env) { /* ... */ }
}`,
      errors: [{ messageId: "stringParamWithLiteralComparison" }],
    },
    // Mixed literal and template literal
    {
      code: `function classify(category: string) {
  if (category === "a") return 1;
  if (category === \`b\`) return 2;
}`,
      errors: [{ messageId: "stringParamWithLiteralComparison" }],
    },
  ],
});
