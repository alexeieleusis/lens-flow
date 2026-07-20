// eslint-plugin/src/rules/no-overly-complex-infer-chain-t63.ts
import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T63-template-literal-types.md");

function hasInferInConstructor(node: TSESTree.TypeNode): boolean {
  if (node.type !== "TSConstructorType") return false;
  const ctor = node as unknown as TSESTree.TSConstructorType;
  const params = ctor.params ?? [];
  if (params.some((p: TSESTree.Parameter) => {
    const inner = p.type === "TSParameterProperty" ? p.parameter : p;
    const ta = inner.typeAnnotation?.typeAnnotation;
    return ta ? containsInfer(ta) : false;
  })) return true;
  const ret = ctor.returnType?.typeAnnotation;
  return ret ? containsInfer(ret) : false;
}

function containsInfer(node: TSESTree.TypeNode): boolean {
  if (node.type === "TSInferType") return true;
  if (hasInferInConstructor(node)) return true;
  if (node.type === "TSConditionalType") {
    return containsInfer(node.checkType) || containsInfer(node.extendsType);
  }
  if (node.type === "TSTypeOperator") {
    return node.typeAnnotation ? containsInfer(node.typeAnnotation) : false;
  }
  return checkGenericProperties(node);
}

function checkGenericProperties(node: TSESTree.TypeNode): boolean {
  for (const prop of ["types", "typeAnnotation", "elementType"]) {
    if (!(prop in node)) continue;
    const child = (node as unknown as Record<string, unknown>)[prop];
    if (checkChildForInfer(child)) return true;
  }
  return false;
}

function checkChildForInfer(child: unknown): boolean {
  if (!child) return false;
  if (Array.isArray(child)) return child.some(containsInfer);
  if (typeof child === "object" && "type" in child) {
    return containsInfer(child as TSESTree.TypeNode);
  }
  return false;
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
         "Found a recursive conditional type with `infer` nested {{depth}} levels deep (max allowed: {{maxDepth}}). Consider simplifying or using a function-based approach. See: {{url}}",
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
              url: URL,
            },
          });
        }
      },
    };
  },
});
