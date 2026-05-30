import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-deeply-nested-as-const.js";

ruleTester.run("no-deeply-nested-as-const", rule, {
  valid: [
    `const API_ENDPOINTS = {
      users: "users"
    } as const;`,
    `const CONFIG = {
      api: {
        base: "https://example.com"
      }
    } as const;`,
    `const flat = { a: 1, b: 2 } as const;`,
    `const arr = [1, 2, { a: 3 }] as const;`,
    `const labelled = { a: 1 } as const;`,
  ],
  invalid: [
    {
      code: `const API = {
  endpoints: {
    users: { id: 123, name: "users" }
  }
} as const;`,
      errors: [{ messageId: "deeplyNested" }],
    },
    {
      code: `const config = {
  a: {
    b: {
      c: { d: 1 }
    }
  }
} as const;`,
      errors: [{ messageId: "deeplyNested" }],
    },
    {
      code: `const matrix = [
  [[1, 2], [3, 4]]
] as const;`,
      errors: [{ messageId: "deeplyNested" }],
    },
    {
      code: `const deep = {
  x: { y: [{ z: true }] }
} as const;`,
      errors: [{ messageId: "deeplyNested" }],
    },
  ],
});
