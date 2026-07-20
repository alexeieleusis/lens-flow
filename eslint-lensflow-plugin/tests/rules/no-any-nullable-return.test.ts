import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-any-nullable-return.js";

ruleTester.run("no-any-nullable-return", rule, {
  valid: [
    // Correct: concrete return type with nullish coalescing
    `function getData(): Data | null {
      return fetchData() ?? null;
    }`,
    // No nullish coalescing in return
    `function getData(): any {
      return fetchData();
    }`,
    // Return type is not any
    `function getData(): string | null {
      return fetchData() ?? null;
    }`,
    // Arrow function with proper return type
    `const getData = (): Data | null => fetchData() ?? null;`,
    // Nullish coalescing but not in return statement
    `function getData(): any {
      const val = fetchData() ?? null;
      return val;
    }`,
    // Outer any function should not be flagged for inner function's nullable return
    `function outer(): any {
      const inner = (): string | null => { return value ?? null; };
      return outerData();
    }`,
    // `??` with non-nullish right operand should pass
    `function getData(): any {
      return fetchData() ?? defaultValue;
    }`,
  ],
  invalid: [
    // Function declaration with any return and ?? null
    {
      code: `function getData(): any {
        return fetchData() ?? null;
      }`,
      errors: [{ messageId: "anyNullableReturn" }],
    },
    // Arrow function with any return and ?? undefined
    {
      code: `const getData = (): any => fetchData() ?? undefined;`,
      errors: [{ messageId: "anyNullableReturn" }],
    },
    // Arrow function with block body, any return, and ?? null
    {
      code: `const getData = (): any => { return fetchData() ?? null; };`,
      errors: [{ messageId: "anyNullableReturn" }],
    },
    // Function expression with any return and ?? null
    {
      code: `const obj = {
        getData(): any {
          return fetchData() ?? null;
        }
      };`,
      errors: [{ messageId: "anyNullableReturn" }],
    },
    // Standalone function expression with any return and ?? null
    {
      code: `const getData = function(): any { return fetchData() ?? null; };`,
      errors: [{ messageId: "anyNullableReturn" }],
    },
    // Nested nullish coalescing
    {
      code: `function getData(): any {
        return (fetchData() ?? getData2()) ?? null;
      }`,
      errors: [{ messageId: "anyNullableReturn" }],
    },
    // Class method with any return and ?? null
    {
      code: `class C { getData(): any { return fetchData() ?? null; } }`,
      errors: [{ messageId: "anyNullableReturn" }],
    },
  ],
});
