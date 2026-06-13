import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-typeof-in-type-alias.js";

ruleTester.run("no-typeof-in-type-alias", rule, {
  valid: [
    `interface ConfigShape {
      host: string;
      port: number;
    }`,
    `type ConfigShape = {
      host: string;
      port: number;
    };`,
    `type Id = string;`,
    `type Mapped = Record<string, number>;`,
  ],
  invalid: [
    {
      code: `const config = { host: "localhost", port: 3000 };
type ConfigShape = typeof config;`,
      errors: [{ messageId: "typeofInAlias" }],
    },
    {
      code: `const x = { a: 1, b: "hello" };
type NestedShape = { key: typeof x };`,
      errors: [{ messageId: "typeofInAlias" }],
    },
    {
      code: `const val = 42;
type Wrapper = { value: typeof val };`,
      errors: [{ messageId: "typeofInAlias" }],
    },
  ],
});
