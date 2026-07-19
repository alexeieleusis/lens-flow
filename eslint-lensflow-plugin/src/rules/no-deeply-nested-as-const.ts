import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T32-immutability-markers.md");

function computeNestingDepth(
  node: TSESTree.ObjectExpression | TSESTree.ArrayExpression,
): number {
  let maxDepth = 1;

  const values: TSESTree.Expression[] =
    node.type === "ObjectExpression"
      ? node.properties
          .map((p) => {
            if (p.type === "Property" && p.value) return p.value;
            if (p.type === "SpreadElement") return p.argument;
            return null;
          })
          .filter((v): v is TSESTree.Expression => v !== null)
      : node.elements
           .map((e) => {
             if (e === null) return null;
             if (e.type === "SpreadElement") return e.argument;
             return e;
           })
           .filter((v): v is TSESTree.Expression => v !== null);

  for (const value of values) {
    let unwrapped: TSESTree.Expression = value;
    while (
      unwrapped.type === "TSAsExpression" ||
      unwrapped.type === "TSSatisfiesExpression" ||
      unwrapped.type === "TSNonNullExpression"
    ) {
      unwrapped = "expression" in unwrapped
        ? (unwrapped as any).expression
        : value;
    }

    if (
      unwrapped.type === "ObjectExpression" ||
      unwrapped.type === "ArrayExpression"
    ) {
      const childDepth = computeNestingDepth(unwrapped);
      maxDepth = Math.max(maxDepth, 1 + childDepth);
    }
  }

  return maxDepth;
}

export default createRule({
  name: "no-deeply-nested-as-const",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow `as const` on deeply nested object literals that lock transient data recursively",
    },
    messages: {
      deeplyNested:
        "`as const` on an object/array with nesting depth {{depth}} locks everything recursively including transient data. Split into separate const declarations for static config parts. See: {{url}}",
    },
    schema: [
      {
        type: "object",
        properties: {
          threshold: {
            type: "number",
            minimum: 1,
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
  },
  defaultOptions: [{ threshold: 3 }],
  create(context: TSESLint.RuleContext<"deeplyNested", [{ threshold: number }]>) {
    const { threshold = 3 } = context.options[0] ?? {};

    return {
      TSAsExpression(node) {
        if (node.typeAnnotation.type !== "TSTypeReference") return;
        if (
          node.typeAnnotation.typeName.type !== "Identifier" ||
          node.typeAnnotation.typeName.name !== "const"
        )
          return;

        const expr = node.expression;
        if (
          expr.type !== "ObjectExpression" &&
          expr.type !== "ArrayExpression"
        )
          return;

        const depth = computeNestingDepth(expr);
        if (depth >= threshold) {
          context.report({
            node,
            messageId: "deeplyNested",
            data: {
              depth: String(depth),
              url: URL,
            },
          });
        }
      },
    };
  },
});
