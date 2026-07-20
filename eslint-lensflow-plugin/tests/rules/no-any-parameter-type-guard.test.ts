import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-any-parameter-type-guard.js";

ruleTester.run("no-any-parameter-type-guard", rule, {
  valid: [
    `type StrictTree = {
      value: number;
      left?: StrictTree;
      right?: StrictTree;
    };
    // TypeScript catches errors at compile time; no runtime validation function needed`,
    `type Node = { value: number; children?: Node[] };

function processNode(node: Node): boolean {
  return typeof node.value === "number";
}`,
    `type StrictTree = {
      value: number;
      left?: StrictTree;
      right?: StrictTree;
    };

function validateTree(node: StrictTree): node is StrictTree {
  return typeof node.value === "number";
}`,
    `function check(x: unknown): x is string {
  return typeof x === "string";
}`,
  ],
  invalid: [
    {
      code: `type LooselyTypedTree = {
        value: number;
        left?: LooselyTypedTree;
        right?: LooselyTypedTree;
      };

      function validateTree(node: any): node is LooselyTypedTree {
        if (typeof node.value !== "number") return false;
        if (node.left && !validateTree(node.left)) return false;
        if (node.right && !validateTree(node.right)) return false;
        return true;
      }`,
      errors: [{ messageId: "anyParamWithTypeGuard" }],
    },
    {
      code: `type Shape = { sides: number };

const isShape = (obj: any): obj is Shape => {
  return typeof obj.sides === "number";
};`,
      errors: [{ messageId: "anyParamWithTypeGuard" }],
    },
  ],
});
