import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("usecases/UC08-error-handling.md");

function countOptionalChainDepth(node: TSESTree.Node): number {
  if (node.type === "ChainExpression") {
    return countMemberDepth(node.expression);
  }
  return 0;
}

function countMemberDepth(node: TSESTree.Node): number {
  if (node.type === "MemberExpression" && node.optional) {
    return 1 + countMemberDepth(node.object);
  }
  return 0;
}

function isLogicalExpression(
  node: TSESTree.Node,
): node is TSESTree.LogicalExpression {
  return node.type === "LogicalExpression";
}

function countNullishCoalesces(node: TSESTree.Node): number {
  if (node.type === "LogicalExpression" && node.operator === "??") {
    return (
      1 + countNullishCoalesces(node.left) + countNullishCoalesces(node.right)
    );
  }
  return 0;
}

export default createRule({
  name: "no-deep-optional-chain-fallback",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow deep optional chaining with multiple nullish-coalescing fallbacks that silently mask missing fields",
    },
    messages: {
      deepChain:
        "Deep optional chain (depth: {{depth}}) with {{fallbacks}} nullish-coalescing fallback(s) silently masks missing fields. Handle missing fields explicitly instead of chaining defaults. See: {{url}}",
    },
    schema: [
      {
        type: "object",
        properties: {
          minDepth: {
            type: "number",
            minimum: 1,
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
  },
  defaultOptions: [{ minDepth: 2 }],
  create(context: TSESLint.RuleContext<"deepChain", [{ minDepth: number }]>) {
    const [{ minDepth } = { minDepth: 2 }] = context.options ?? [];

    return {
      LogicalExpression(node) {
        if (node.operator !== "??") return;

        const ancestors = context.sourceCode.getAncestors(node);
        const parentIsCoalesce = ancestors.length > 0 &&
          ancestors[ancestors.length - 1].type === "LogicalExpression" &&
          (ancestors[ancestors.length - 1] as TSESTree.LogicalExpression).operator === "??";
        if (parentIsCoalesce) return;

        const fallbackCount = countNullishCoalesces(node);

        let leftmost: TSESTree.Expression = node;
        while (isLogicalExpression(leftmost) && leftmost.operator === "??") {
          leftmost = leftmost.left;
        }

        const depth = countOptionalChainDepth(leftmost);

        if (depth >= minDepth || fallbackCount >= 2) {
          context.report({
            node,
            messageId: "deepChain",
            data: {
              depth: String(depth),
              fallbacks: String(fallbackCount),
              url: URL,
            },
          });
        }
      },
    };
  },
});
