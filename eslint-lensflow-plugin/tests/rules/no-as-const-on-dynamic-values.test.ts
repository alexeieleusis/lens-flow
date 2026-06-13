import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-as-const-on-dynamic-values.js";

ruleTester.run("no-as-const-on-dynamic-values", rule, {
  valid: [
    `const config = {
      apiUrl: "https://prod.api.com",
      timeout: 5000,
    } as const;`,
    `const items = ["a", "b", "c"] as const;`,
    `const nested = {
      a: { b: 1, c: "hello" },
      d: [true, false],
    } as const;`,
    `const neg = { value: -42 } as const;`,
    `const tpl = { msg: \`hello\` } as const;`,
    `const mixed = {
      literal: 1,
      nested: { deep: [1, 2, 3] },
    } as const;`,
    `const literalKey = { ["key"]: "value" } as const;`,
    `const x = { ...{ a: 1, b: "hello" }, c: true } as const;`,
    `const x = { a: 1, ...{ b: 2 } } as const;`,
    `const x = [...["a", "b"], "c"] as const;`,
    `const x = ["a", ...["b", "c"]] as const;`,
    `const x = [...[1, 2], ...[3, 4]] as const;`,
    `const x = [...[], "a"] as const;`,
  ],
  invalid: [
    {
      code: `function getConfig(environment: string) {
  const config = {
    apiUrl: environment === "prod" ? "https://prod.api.com" : "http://localhost",
  } as const;
}`,
      errors: [{ messageId: "dynamicAsConst" }],
    },
    {
      code: `const arr = [getBaseUrl()] as const;`,
      errors: [{ messageId: "dynamicAsConst" }],
    },
    {
      code: `const config = {
  host: process.env.HOST,
  port: 3000,
} as const;`,
      errors: [{ messageId: "dynamicAsConst" }],
    },
    {
      code: `const x = { a: foo + bar } as const;`,
      errors: [{ messageId: "dynamicAsConst" }],
    },
    {
      code: `const items = [a, b, c] as const;`,
      errors: [{ messageId: "dynamicAsConst" }],
    },
    {
      code: `const config = {
  baseUrl: env === "prod" ? "https://prod.com" : "http://localhost",
  items: [getItems()],
} as const;`,
      errors: [{ messageId: "dynamicAsConst" }],
    },
    {
      code: `const x = { a: \`hello \${name}\` } as const;`,
      errors: [{ messageId: "dynamicAsConst" }],
    },
    {
      code: `const x = { a: obj?.method() } as const;`,
      errors: [{ messageId: "dynamicAsConst" }],
    },
    {
      code: `const x = { a: tag\`template\` } as const;`,
      errors: [{ messageId: "dynamicAsConst" }],
    },
    {
      code: `const envKey = "environment";
const config = { [envKey]: "prod" } as const;`,
      errors: [{ messageId: "dynamicAsConst" }],
    },
    {
      code: `const config = { [getDynamicKey()]: "static" } as const;`,
      errors: [{ messageId: "dynamicAsConst" }],
    },
    {
      code: `const x = { ...getDefaults(), a: 1 } as const;`,
      errors: [{ messageId: "dynamicAsConst" }],
    },
    {
      code: `const x = { a: 1, ...defaults } as const;`,
      errors: [{ messageId: "dynamicAsConst" }],
    },
    {
      code: `const x = { ...obj[key] } as const;`,
      errors: [{ messageId: "dynamicAsConst" }],
    },
    {
      code: `const merged = { ...staticA, ...staticB } as const;`,
      errors: [{ messageId: "dynamicAsConst" }],
    },
    {
      code: `const x = [...getItems(), "static"] as const;`,
      errors: [{ messageId: "dynamicAsConst" }],
    },
    {
      code: `const x = ["static", ...items] as const;`,
      errors: [{ messageId: "dynamicAsConst" }],
    },
    {
      code: `const x = [...a, ...b] as const;`,
      errors: [{ messageId: "dynamicAsConst" }],
    },
    {
      code: `const x = [...obj[key]] as const;`,
      errors: [{ messageId: "dynamicAsConst" }],
    },
    {
      code: `const x = [1, ...getItems(), 2] as const;`,
      errors: [{ messageId: "dynamicAsConst" }],
    },
  ],
});
