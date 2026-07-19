import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

const URL = knowledgeUrl("usecases/UC04-generic-constraints.md");

function unwrapExpression(
  node: TSESTree.Expression,
): TSESTree.Expression {
  if (node.type === "TSNonNullExpression") return node.expression;
  if (node.type === "ChainExpression") return node.expression;
  return node;
}

function findTSTypeLiteralInTypes(
  types: TSESTree.TypeNode[],
): TSESTree.TypeNode | undefined {
  for (const type of types) {
    if (type.type === "TSTypeLiteral") return type;
    const unwrapped = unwrapTypeAnnotation(type);
    if (unwrapped.type === "TSTypeLiteral") return unwrapped;
  }
  return undefined;
}

function unwrapTypeAnnotation(
  node: TSESTree.TypeNode,
): TSESTree.TypeNode {
  if (node.type === "TSIntersectionType" || node.type === "TSUnionType") {
    const found = findTSTypeLiteralInTypes(node.types);
    if (found) return found;
  }
  return node;
}

function isCastToShape(node: TSESTree.Expression): boolean {
  const inner = unwrapExpression(node);
  if (inner.type !== "TSAsExpression" && inner.type !== "TSSatisfiesExpression")
    return false;
  const unwrapped = unwrapTypeAnnotation(inner.typeAnnotation);
  return unwrapped.type === "TSTypeLiteral";
}

export default createRule({
  name: "no-cast-to-shape-then-access",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow casting to an inline shape then immediately accessing a property, which suggests using a generic constraint instead.",
    },
    messages: {
      castToShapeThenAccess:
        "Casting to an inline shape `as { ... }` then accessing a property indicates a missing generic constraint. Use `T extends { ... }` on the function instead. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"castToShapeThenAccess", []>) {
    return {
      MemberExpression(node) {
        if (isCastToShape(node.object)) {
          context.report({
            node: node.object,
            messageId: "castToShapeThenAccess",
            data: { url: URL },
          });
        }
      },
    };
  },
});
