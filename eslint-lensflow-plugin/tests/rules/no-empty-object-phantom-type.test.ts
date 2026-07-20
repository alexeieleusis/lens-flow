import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-empty-object-phantom-type.js";

ruleTester.run("no-empty-object-phantom-type", rule, {
  valid: [
    `type Closed = { readonly _state: unique symbol };`,
    `type Open = { readonly _state: unique symbol };`,
    `interface State { status: string; }`,
    `type Config = { host: string; port: number; }`,
  ],
  invalid: [
    {
      code: `type Closed = {};\ntype Open = {};\nclass Db<S> {}`,
      errors: [
        { messageId: "emptyObjectPhantomType" },
        { messageId: "emptyObjectPhantomType" },
      ],
    },
    {
      code: `type Pending = {}`,
      errors: [{ messageId: "emptyObjectPhantomType" }],
    },
    {
      code: `type Wrapped = ({})`,
      errors: [{ messageId: "emptyObjectPhantomType" }],
    },
    {
      code: `type DeeplyWrapped = (({}))`,
      errors: [{ messageId: "emptyObjectPhantomType" }],
    },
  ],
});
