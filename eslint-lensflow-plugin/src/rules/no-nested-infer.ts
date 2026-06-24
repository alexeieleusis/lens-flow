import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T49-associated-types.md");

function hasDeeplyNestedInfer(
  extendsType: TSESTree.TypeNode,
  maxDepth: number,
): boolean {
  function check(
    node: TSESTree.TypeNode,
    depth: number,
  ): boolean {
    switch (node.type) {
      case "TSInferType":
        return depth >= maxDepth;

      case "TSTypeReference": {
        const nextDepth = depth + 1;
        if (node.typeArguments) {
          return node.typeArguments.params.some((t) => check(t, nextDepth));
        }
        return false;
      }

      case "TSIndexedAccessType": {
        const nextDepth = depth + 1;
        return check(node.objectType, nextDepth) || check(node.indexType, nextDepth);
      }

      case "TSArrayType": {
        const nextDepth = depth + 1;
        return check(node.elementType, nextDepth);
      }

      case "TSTypeLiteral":
        return (node.members ?? []).some(
          (member) =>
            member.type === "TSPropertySignature" &&
            member.typeAnnotation &&
            check(member.typeAnnotation.typeAnnotation, depth + 1),
        );

      case "TSUnionType":
      case "TSIntersectionType":
        return node.types.some((t) => check(t, depth));

      case "TSConditionalType":
        return (
          check(node.checkType, depth) ||
          check(node.extendsType, depth) ||
          check(node.trueType, depth) ||
          check(node.falseType, depth)
        );

      default:
        return false;
    }
  }

  return check(extendsType, 0);
}

export default createRule({
  name: "no-nested-infer",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow deeply nested `infer` inside conditional types that creates hard-to-read type definitions",
    },
    messages: {
      deeplyNestedInfer:
        "Deeply nested `infer` (depth {{depth}}) inside conditional type creates hard-to-read type definitions. Extract into separate type aliases for clarity. See: {{url}}",
    },
    schema: [
      {
        type: "object",
        properties: {
          maxDepth: {
            type: "number",
            minimum: 1,
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
  },
  defaultOptions: [{ maxDepth: 2 }],
  create(context: TSESLint.RuleContext<"deeplyNestedInfer", [{ maxDepth: number }]>) {
    const [{ maxDepth } = { maxDepth: 2 }] = context.options ?? [];

    return {
      TSConditionalType(node) {
        const { extendsType } = node;

        if (hasDeeplyNestedInfer(extendsType, maxDepth)) {
          context.report({
            node,
            messageId: "deeplyNestedInfer",
            data: {
              depth: String(maxDepth),
              url: URL,
            },
          });
        }
      },
    };
  },
});
