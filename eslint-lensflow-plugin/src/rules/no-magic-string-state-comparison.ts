import { createRule } from "../utils/rule-creator.js";
import { walkNodes } from "../utils/ast-helpers.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

function isThisMemberExpression(node: unknown): node is TSESTree.MemberExpression {
  return (
    node != null &&
    typeof node === "object" &&
    "type" in node &&
    node.type === "MemberExpression"
  );
}

function getThisPropertyName(node: TSESTree.MemberExpression): string | null {
  if (node.property.type === "Identifier") return node.property.name;
  return null;
}

function isThisStateAssignment(node: TSESTree.Node, propName: string): boolean {
  if (node.type !== "AssignmentExpression") return false;
  const assign = node;
  if (!isThisMemberExpression(assign.left)) return false;
  if (assign.left.object.type !== "ThisExpression") return false;
  return getThisPropertyName(assign.left) === propName;
}

function findAssignmentInConsequent(consequent: TSESTree.Statement, propName: string): boolean {
  const statements: TSESTree.Statement[] =
    consequent.type === "BlockStatement" ? consequent.body : [consequent];

  for (const stmt of statements) {
    if (walkNodes(stmt, (node) => isThisStateAssignment(node, propName))) return true;
  }
  return false;
}

export default createRule({
  name: "no-magic-string-state-comparison",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallows comparing a state property against a magic string literal to gate a state transition — use typestate to make invalid transitions a compile error instead",
    },
    messages: {
      magicStringStateComparison:
        "Comparing this.{{prop}} against a magic string literal (\"{{value}}\") to gate a state transition. Use typestate to encode valid transitions at the type level. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T57-typestate.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"magicStringStateComparison", []>) {
    return {
      "MethodDefinition IfStatement"(node) {
        const ifNode = node as unknown as { test: unknown };
        const test = ifNode.test;

        if (
          !test ||
          typeof test !== "object" ||
          (test as { type: unknown }).type !== "BinaryExpression"
        )
          return;

        const bin = test as unknown as { left: unknown; right: unknown; operator: string };
        if (bin.operator !== "==" && bin.operator !== "===") return;

        const { left, right } = bin;

        let propName: string | null = null;
        let stringValue: string | null = null;

        if (isThisMemberExpression(left)) {
          propName = getThisPropertyName(left);
          if (
            right &&
            typeof right === "object" &&
            "type" in right &&
            right.type === "Literal" &&
           typeof (right as unknown as { value: unknown }).value === "string"
           ) {
            stringValue = (right as unknown as { value: string }).value;
          }
        } else if (isThisMemberExpression(right)) {
          propName = getThisPropertyName(right);
          if (
            left &&
            typeof left === "object" &&
            "type" in left &&
            left.type === "Literal" &&
           typeof (left as unknown as { value: unknown }).value === "string"
           ) {
            stringValue = (left as unknown as { value: string }).value;
          }
        }

        if (propName === null || stringValue === null) return;

        if (findAssignmentInConsequent((node as unknown as { consequent: TSESTree.Statement }).consequent, propName)) {
          context.report({
            node,
            messageId: "magicStringStateComparison",
            data: { prop: propName, value: stringValue },
          });
        }
      },
    };
  },
});
