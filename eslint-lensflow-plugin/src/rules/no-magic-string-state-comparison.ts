import { TSESTree, type TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T57-typestate.md");

function isThisMemberExpression(
  node: TSESTree.Node,
): node is TSESTree.MemberExpression {
  if (node.type !== "MemberExpression") return false;
  if (node.object.type !== "ThisExpression") return false;
  if (node.property.type !== "Identifier") return false;
  return true;
}

function getThisPropertyName(node: TSESTree.MemberExpression): string | null {
  if (node.property.type === "Identifier") {
    return node.property.name;
  }
  return null;
}

function shouldSkipNodeKey(key: string): boolean {
  return key === "parent" || key === "loc" || key === "range";
}

const FunctionBoundaryTypes = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
]);

function traverseChildren(
  node: TSESTree.Node,
  check: (n: TSESTree.Node) => boolean,
): boolean {
  for (const key of Object.keys(node)) {
    if (shouldSkipNodeKey(key)) continue;
    const child = (node as any)[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        if (
          item &&
          typeof item === "object" &&
          "type" in item &&
          check(item as TSESTree.Node)
        )
          return true;
      }
    } else if (
      child &&
      typeof child === "object" &&
      "type" in child &&
      check(child as TSESTree.Node)
    ) {
      return true;
    }
  }
  return false;
}

function isStateAssignmentMatch(
  node: TSESTree.Node,
  propName: string,
): boolean {
  if (node.type !== "AssignmentExpression") return false;
  const assign = node;
  if (!isThisMemberExpression(assign.left)) return false;
  const assignedProp = getThisPropertyName(assign.left);
  return assignedProp === propName;
}

function findAssignmentInConsequent(
  consequent: TSESTree.BlockStatement,
  propName: string,
): boolean {
  const visited = new WeakSet<TSESTree.Node>();

  function checkNode(node: TSESTree.Node): boolean {
    if (visited.has(node)) return false;
    visited.add(node);

    // Stop at function boundaries — don't attribute inner-function
    // constructs to the outer scope.
    if (FunctionBoundaryTypes.has(node.type)) return false;

    if (isStateAssignmentMatch(node, propName)) return true;
    return traverseChildren(node, checkNode);
  }

  for (const stmt of consequent.body) {
    if (checkNode(stmt)) return true;
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
        'Comparing this.{{prop}} against a magic string literal ("{{value}}") to gate a state transition. Use typestate to encode valid transitions at the type level. See: {{url}}',
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"magicStringStateComparison", []>) {
    return {
      IfStatement(node) {
        const test = node.test;

        if (test.type !== "BinaryExpression") return;
        if (test.operator !== "==" && test.operator !== "===") return;

        const { left, right } = test;

        let propName: string | null = null;
        let stringValue: string | null = null;

        if (isThisMemberExpression(left)) {
          propName = getThisPropertyName(left);
          if (right.type === "Literal" && typeof right.value === "string") {
            stringValue = right.value;
          }
        } else if (isThisMemberExpression(right)) {
          propName = getThisPropertyName(right);
          if (left.type === "Literal" && typeof left.value === "string") {
            stringValue = left.value;
          }
        }

        if (propName === null || stringValue === null) return;

        if (node.consequent.type !== "BlockStatement") return;
        if (findAssignmentInConsequent(node.consequent, propName)) {
          context.report({
            node,
            messageId: "magicStringStateComparison",
            data: { prop: propName, value: stringValue, url: URL },
          });
        }
      },
    };
  },
});
