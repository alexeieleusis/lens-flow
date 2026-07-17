// eslint-plugin/src/rules/no-overly-complex-infer-chain-t63.ts
import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

function containsInfer(node: TSESTree.TypeNode): boolean {
  if (node.type === "TSInferType") return true;
  if (node.type === "TSTemplateLiteralType") return node.types.some(containsInfer);
  if (node.type === "TSUnionType") return node.types.some(containsInfer);
  if (node.type === "TSIntersectionType") return node.types.some(containsInfer);
  if (node.type === "TSConditionalType") return containsInfer(node.checkType) || containsInfer(node.extendsType);
  if (node.type === "TSTypeOperator") return node.typeAnnotation ? containsInfer(node.typeAnnotation) : false;
  if (node.type === "TSConstructorType") {
    const ctor = node as unknown as TSESTree.TSConstructorType;
    const params = ctor.params ?? [];
    return params.some((p: TSESTree.Parameter) => {
      const inner = p.type === "TSParameterProperty" ? p.parameter : p;
      const ta = inner.typeAnnotation?.typeAnnotation;
      return ta ? containsInfer(ta) : false;
    }) ||
      ctor.returnType?.typeAnnotation ? containsInfer((ctor.returnType as TSESTree.TSTypeAnnotation).typeAnnotation) : false;
  }
  if (isNodeWithTypeAnnotation(node)) return node.typeAnnotation ? containsInfer(node.typeAnnotation) : false;
  if (isNodeWithElementType(node)) return node.elementType ? containsInfer(node.elementType) : false;
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

function hasTemplateInferExtendsType(node: TSESTree.TSConditionalType): boolean {
  let ext = node.extendsType;
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
  create(context: TSESLint.RuleContext<"complexInferChain", [{ maxDepth?: number }]>) {
    const [{ maxDepth } = { maxDepth: 3 }] = context.options ?? [{ maxDepth: 3 }];
    const effectiveMaxDepth = maxDepth ?? 3;

    return {
      TSConditionalType(node) {
        if (!hasTemplateInferExtendsType(node)) return;

        const depth = measureDepth(node);
        if (depth > effectiveMaxDepth) {
          context.report({
            node,
            messageId: "complexInferChain",
            data: {
              depth: String(depth),
              maxDepth: String(effectiveMaxDepth),
            },
          });
        }
      },
    };
  },
});
