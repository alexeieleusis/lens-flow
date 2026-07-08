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
    `const shallow = [...[1, 2]] as const;`,
    `const shallowSpread = [...[1, 2], ...[3, 4]] as const;`,
    // Function argument
    `foo({ a: 1 } as const);`,
    // Return statement
    `function getConfig() { return { a: 1 } as const; }`,
    // Property assignment
    `obj.config = { a: 1 } as const;`,
    // Class field initializer
    `class C { config = { a: 1 } as const; }`,
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
    {
      code: `const x = [...[[[1]]]] as const;`,
      errors: [{ messageId: "deeplyNested" }],
    },
    {
      code: `const y = [...[[{ a: 1 }]]] as const;`,
      errors: [{ messageId: "deeplyNested" }],
    },
    {
      code: `const shallowNested = [...[{ a: 1 }]] as const;`,
      errors: [{ messageId: "deeplyNested" }],
    },
    // Function argument
    {
      code: `fetchData({ api: { endpoints: { users: { id: 1 } } } } as const);`,
      errors: [{ messageId: "deeplyNested" }],
    },
    // Return statement
    {
      code: `function getConfig() { return { a: { b: { c: 1 } } } as const; }`,
      errors: [{ messageId: "deeplyNested" }],
    },
    // Property assignment
    {
      code: `obj.mapping = { x: { y: { z: true } } } as const;`,
      errors: [{ messageId: "deeplyNested" }],
    },
    // Class field initializer
    {
      code: `class Config { defaults = { a: { b: { c: 1 } } } as const; }`,
      errors: [{ messageId: "deeplyNested" }],
    },
  ],
});
