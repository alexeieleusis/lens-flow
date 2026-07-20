import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-as-const-on-dynamic-values.js";

ruleTester.run("no-as-const-on-dynamic-values", rule, {
  valid: [
    // Static config object with string and number literals
    `const config = {
      apiUrl: "https://prod.api.com",
      timeout: 5000,
    } as const;`,
    // Static string array literal
    `const items = ["a", "b", "c"] as const;`,
    // Deeply nested static object with literals
    `const nested = {
      a: { b: 1, c: "hello" },
      d: [true, false],
    } as const;`,
    // Static object with null value
    `const x = { a: null } as const;`,
    // Static object with negative number literal
    `const neg = { value: -42 } as const;`,
    // Static object with plain template literal (no interpolation)
    `const tpl = { msg: \`hello\` } as const;`,
    // Mixed nested structure with all literal values
    `const mixed = {
      literal: 1,
      nested: { deep: [1, 2, 3] },
    } as const;`,
    // Computed property key from string literal
    `const literalKey = { ["key"]: "value" } as const;`,
    // Spread of static object literal with additional literal property
    `const x = { ...{ a: 1, b: "hello" }, c: true } as const;`,
    // Literal property followed by spread of static object literal
    `const x = { a: 1, ...{ b: 2 } } as const;`,
    // Spread of static array literal with additional string element
    `const x = [...["a", "b"], "c"] as const;`,
    // String element followed by spread of static array literal
    `const x = ["a", ...["b", "c"]] as const;`,
    // Multiple spreads of static array literals
    `const x = [...[1, 2], ...[3, 4]] as const;`,
    // Spread of empty array literal with string element
    `const x = [...[], "a"] as const;`,
  ],
  invalid: [
    // Conditional (ternary) expression in object value
    {
      code: `function getConfig(environment: string) {
  const config = {
    apiUrl: environment === "prod" ? "https://prod.api.com" : "http://localhost",
  } as const;
}`,
      errors: [{ messageId: "dynamicAsConst" }],
    },
    // Function call as array element
    {
      code: `const arr = [getBaseUrl()] as const;`,
      errors: [{ messageId: "dynamicAsConst" }],
    },
    // process.env property access in object value
    {
      code: `const config = {
  host: process.env.HOST,
  port: 3000,
} as const;`,
      errors: [{ messageId: "dynamicAsConst" }],
    },
    // Binary expression (addition) in object value
    {
      code: `const x = { a: foo + bar } as const;`,
      errors: [{ messageId: "dynamicAsConst" }],
    },
    // Identifier references as array elements
    {
      code: `const items = [a, b, c] as const;`,
      errors: [{ messageId: "dynamicAsConst" }],
    },
    // Conditional and function call in nested object structure
    {
      code: `const config = {
  baseUrl: env === "prod" ? "https://prod.com" : "http://localhost",
  items: [getItems()],
} as const;`,
      errors: [{ messageId: "dynamicAsConst" }],
    },
    // Template literal with interpolation
    {
      code: `const x = { a: \`hello \${name}\` } as const;`,
      errors: [{ messageId: "dynamicAsConst" }],
    },
    // Optional chaining with method call
    {
      code: `const x = { a: obj?.method() } as const;`,
      errors: [{ messageId: "dynamicAsConst" }],
    },
    // Tagged template literal
    {
      code: `const x = { a: tag\`template\` } as const;`,
      errors: [{ messageId: "dynamicAsConst" }],
    },
    // Computed property key from identifier
    {
      code: `const envKey = "environment";
const config = { [envKey]: "prod" } as const;`,
      errors: [{ messageId: "dynamicAsConst" }],
    },
    // Computed property key from function call
    {
      code: `const config = { [getDynamicKey()]: "static" } as const;`,
      errors: [{ messageId: "dynamicAsConst" }],
    },
    // Spread of function call result in object
    {
      code: `const x = { ...getDefaults(), a: 1 } as const;`,
      errors: [{ messageId: "dynamicAsConst" }],
    },
    // Spread of identifier in object
    {
      code: `const x = { a: 1, ...defaults } as const;`,
      errors: [{ messageId: "dynamicAsConst" }],
    },
    // Spread of computed member expression
    {
      code: `const x = { ...obj[key] } as const;`,
      errors: [{ messageId: "dynamicAsConst" }],
    },
    // Spread of two identifiers merged together
    {
      code: `const merged = { ...staticA, ...staticB } as const;`,
      errors: [{ messageId: "dynamicAsConst" }],
    },
    // Spread of function call result in array
    {
      code: `const x = [...getItems(), "static"] as const;`,
      errors: [{ messageId: "dynamicAsConst" }],
    },
    // Spread of identifier in array
    {
      code: `const x = ["static", ...items] as const;`,
      errors: [{ messageId: "dynamicAsConst" }],
    },
    // Multiple spreads of identifiers in array
    {
      code: `const x = [...a, ...b] as const;`,
      errors: [{ messageId: "dynamicAsConst" }],
    },
    // Spread of computed member expression in array
    {
      code: `const x = [...obj[key]] as const;`,
      errors: [{ messageId: "dynamicAsConst" }],
    },
    // Mixed literals and spread of function call in array
    {
      code: `const x = [1, ...getItems(), 2] as const;`,
      errors: [{ messageId: "dynamicAsConst" }],
    },
    // undefined as object value
    {
      code: `const x = { a: undefined } as const;`,
      errors: [{ messageId: "dynamicAsConst" }],
    },
    // void expression as object value
    {
      code: `const y = { b: void 0 } as const;`,
      errors: [{ messageId: "dynamicAsConst" }],
    },
    // Unary negation (!) operator as object value
    {
      code: `const x = { a: !true } as const;`,
      errors: [{ messageId: "dynamicAsConst" }],
    },
  ],
});
