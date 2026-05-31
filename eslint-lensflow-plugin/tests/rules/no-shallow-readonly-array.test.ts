import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-shallow-readonly-array.js";

ruleTester.run("no-shallow-readonly-array", rule, {
  valid: [
    `interface Node {
      readonly children: readonly Node[];
    }`,
    `interface Config {
      items: string[];
    }`,
    `class Container {
      readonly data: readonly number[];
    }`,
    `interface Flat {
      readonly value: string;
    }`,
    `type State = { readonly items: readonly string[] };`,
  ],
  invalid: [
    {
      code: `interface Node {
        readonly children: Node[];
      }`,
      errors: [{ messageId: "shallowReadonlyArray" }],
    },
    {
      code: `class Container {
        readonly items: string[];
      }`,
      errors: [{ messageId: "shallowReadonlyArray" }],
    },
    {
      code: `interface Tree {
        readonly nodes: TreeNode[];
        readonly values: number[];
      }`,
      errors: [
        { messageId: "shallowReadonlyArray" },
        { messageId: "shallowReadonlyArray" },
      ],
    },
    {
      code: `type Config = {
        readonly plugins: Plugin[];
      }`,
      errors: [{ messageId: "shallowReadonlyArray" }],
    },
  ],
});
