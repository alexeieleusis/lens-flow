import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-primitive-type-alias.js";

ruleTester.run("no-primitive-type-alias", rule, {
  valid: [
    `function setCount(n: number) { /* ... */ }`,
    `type UserId = string & { readonly __brand: "UserId" };`,
    `type State = { kind: "pending" } | { kind: "complete" };`,
  ],
  invalid: [
    {
      code: `type StringId = string;`,
      errors: [{ messageId: "primitiveAlias" }],
    },
    {
      code: `type NumberCount = number;`,
      errors: [{ messageId: "primitiveAlias" }],
    },
    {
      code: `type BooleanFlag = boolean;`,
      errors: [{ messageId: "primitiveAlias" }],
    },
    {
      code: `type VoidR = void;`,
      errors: [{ messageId: "primitiveAlias" }],
    },
    {
      code: `type MyUndef = undefined;`,
      errors: [{ messageId: "primitiveAlias" }],
    },
    {
      code: `type MyNull = null;`,
      errors: [{ messageId: "primitiveAlias" }],
    },
    {
      code: `type MySym = symbol;`,
      errors: [{ messageId: "primitiveAlias" }],
    },
    {
      code: `type MyBig = bigint;`,
      errors: [{ messageId: "primitiveAlias" }],
    },
  ],
});
