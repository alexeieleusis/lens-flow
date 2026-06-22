// eslint-plugin/src/rules/no-overly-complex-infer-chain-t63.ts
import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

function containsInfer(node: TSESTree.TypeNode): boolean {
  if (node.type === "TSInferType") return true;
  if (node.type === "TSTemplateLiteralType") return node.types.some(containsInfer);
  if (node.type === "TSUnionType") return node.types.some(containsInfer);
  if (node.type === "TSIntersectionType") return node.types.some(containsInfer);
  if (node.type === "TSConditionalType") return containsInfer(node.checkType) || containsInfer(node.extendsType);
  if (node.type === "TSParenthesizedType") return containsInfer(node.typeAnnotation);
  if (isNodeWithTypeAnnotation(node)) return containsInfer(node.typeAnnotation);
  if (isNodeWithElementType(node)) return containsInfer(node.elementType);
  if (isNodeWithTypesArray(node)) return getTypesArray(node).some(containsInfer);
  return false;
}

function isNodeWithTypeAnnotation(
  node: TSESTree.TypeNode,
): node is TSESTree.TypeNode & { typeAnnotation: TSESTree.TypeNode } {
  return "typeAnnotation" in node && !!node.typeAnnotation;
}

function isNodeWithElementType(
  node: TSESTree.TypeNode,
): node is TSESTree.TypeNode & { elementType: TSESTree.TypeNode } {
  return "elementType" in node && !!node.elementType;
}

function isNodeWithTypesArray(node: TSESTree.TypeNode): boolean {
  return (
    "types" in node &&
    Array.isArray((node as unknown as Record<string, unknown>).types)
  );
}

function getTypesArray(node: TSESTree.TypeNode): TSESTree.TypeNode[] {
  return ((node as unknown as Record<string, unknown>).types as TSESTree.TypeNode[]);
}

function hasTemplateInferExtendsType(node: TSESTree.TSConditionalType): boolean {
  const ext = node.extendsType;
  return (
    ext.type === "TSTemplateLiteralType" &&
    ext.types.some((q) => containsInfer(q))
  );
}

function measureDepth(node: TSESTree.TSConditionalType): number {
  if (!hasTemplateInferExtendsType(node)) return 0;

  let max = 0;
  const tt = node.trueType;
  const ft = node.falseType;

  if (tt.type === "TSConditionalType" && hasTemplateInferExtendsType(tt)) {
    max = Math.max(max, measureDepth(tt));
  }
  if (ft.type === "TSConditionalType" && hasTemplateInferExtendsType(ft)) {
    max = Math.max(max, measureDepth(ft));
  }

  return 1 + max;
}

export default createRule({
  name: "no-overly-complex-infer-chain-t63",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow recursive conditional types with `infer` and deeply nested conditional branches exceeding the configured max depth.",
    },
    messages: {
      complexInferChain:
        "Found a recursive conditional type with `infer` nested {{depth}} levels deep (max allowed: {{maxDepth}}). Consider simplifying or using a function-based approach. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T63-template-literal-types.md",
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
  defaultOptions: [{ maxDepth: 3 }],
  create(context: TSESLint.RuleContext<"complexInferChain", [{ maxDepth: number }]>) {
    const [{ maxDepth } = { maxDepth: 3 }] = context.options ?? [];

    return {
      TSConditionalType(node) {
        if (!hasTemplateInferExtendsType(node)) return;

        const depth = measureDepth(node);
        if (depth > maxDepth) {
          context.report({
            node,
            messageId: "complexInferChain",
            data: {
              depth: String(depth),
              maxDepth: String(maxDepth),
            },
          });
        }
      },
    };
  },
});
