import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-any-in-recursive-union-variant.js";

ruleTester.run("no-any-in-recursive-union-variant", rule, {
  valid: [
    `type Node = ValueNode | BranchNode;
type ValueNode = { type: "value"; data: string | number };
type BranchNode = { type: "branch"; children: Node[] };`,
    `type State = Pending | Done;
type Pending = { type: "pending"; data: any };
type Done = { type: "done"; result: string };`,
    `interface Fine {
      isPending: boolean;
      isComplete: boolean;
    }`,
    `type Simple = { value: any } | { label: string };`,
    `type RecursiveNoAny = { type: "leaf"; data: string } | { type: "branch"; children: RecursiveNoAny[] };`,
  ],
  invalid: [
    {
      code: `type Node = ValueNode | BranchNode;
type ValueNode = { type: "value"; data: any };
type BranchNode = { type: "branch"; children: Node[] };`,
      errors: [{ messageId: "anyOrUnknownInRecursiveVariant" }],
    },
    {
      code: `type Expr = Lit | BinOp;
type Lit = { type: "lit"; value: unknown };
type BinOp = { type: "bin"; left: Expr; right: Expr };`,
      errors: [{ messageId: "anyOrUnknownInRecursiveVariant" }],
    },
    {
      code: `type Tree = Leaf | Branch;
type Leaf = { type: "leaf"; payload: any | null };
type Branch = { type: "branch"; left: Tree; right: Tree };`,
      errors: [{ messageId: "anyOrUnknownInRecursiveVariant" }],
    },
  ],
});
