import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-any-array-for-children.js";

ruleTester.run("no-any-array-for-children", rule, {
  valid: [
    `type Component = {
      name: string;
      children: Component[];
    }`,
    `interface Node {
      nodes: string[];
    }`,
    `type Tree = {
      items: number;
    }`,
    `type Container = {
      children: unknown[];
    }`,
    `interface Element {
      data: any[];
    }`,
    `type Widget = {
      elements: never[];
    }`,
  ],
  invalid: [
    {
      code: `type Component = {
        name: string;
        children: any[];
      }`,
      errors: [{ messageId: "anyArrayChildren" }],
    },
    {
      code: `interface TreeNode {
        value: string;
        nodes: any[];
      }`,
      errors: [{ messageId: "anyArrayChildren" }],
    },
    {
      code: `type Menu = {
        label: string;
        items: any[];
      }`,
      errors: [{ messageId: "anyArrayChildren" }],
    },
    {
      code: `type Container = {
        elements: any[];
      }`,
      errors: [{ messageId: "anyArrayChildren" }],
    },
    {
      code: `type Tree = {
        subs: any[];
      }`,
      errors: [{ messageId: "anyArrayChildren" }],
    },
    {
      code: `type Tree = {
        sub: any[];
      }`,
      errors: [{ messageId: "anyArrayChildren" }],
    },
    {
      code: `type Component = {
        name: string;
        Children: any[];
      }`,
      errors: [{ messageId: "anyArrayChildren" }],
    },
    {
      code: `type Component = {
        name: string;
        children: Array<any>;
      }`,
      errors: [{ messageId: "anyArrayChildren" }],
    },
    {
      code: `interface TreeNode {
        value: string;
        nodes: Array<any>;
      }`,
      errors: [{ messageId: "anyArrayChildren" }],
    },
    {
      code: `type Component = {
        name: string;
        "children": any[];
      }`,
      errors: [{ messageId: "anyArrayChildren" }],
    },
    {
      code: `type Node = {
        id: number;
        "nodes": Array<any>;
      }`,
      errors: [{ messageId: "anyArrayChildren" }],
    },
  ],
});
