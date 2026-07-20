import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

const URL = knowledgeUrl("catalog/T22-callable-typing.md");

type CallableNode = TSESTree.TSFunctionType | TSESTree.TSMethodSignature | TSESTree.TSCallSignatureDeclaration;

function isAnyCallback(node: CallableNode): boolean {
  if (node.params.length !== 1) return false;

  const param = node.params[0];
  if (param.type !== "RestElement") return false;

  const typeAnn = param.typeAnnotation?.typeAnnotation;

  let isAnyArrayType = false;

  if (
    (typeAnn?.type === "TSArrayType" && typeAnn.elementType.type === "TSAnyKeyword") ||
    (typeAnn?.type === "TSTypeReference" &&
      typeAnn.typeName.type === "Identifier" &&
      typeAnn.typeName.name === "ReadonlyArray" &&
      typeAnn.typeArguments?.params.length === 1 &&
      typeAnn.typeArguments.params[0].type === "TSAnyKeyword")
  ) {
    isAnyArrayType = true;
  }

  if (!isAnyArrayType) return false;

  return node.returnType?.typeAnnotation.type === "TSAnyKeyword";
}

export default createRule({
  name: "no-any-callback-type",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `(...args: any[]) => any` callback types that lose all parameter and return type information",
    },
    messages: {
      anyCallbackType:
        "Avoid `(...args: any[]) => any` callback types — they lose all parameter and return type information. Use an explicit callable type with typed parameters instead. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"anyCallbackType", []>) {
    const reportIfAnyCallback = (node: CallableNode) => {
      if (isAnyCallback(node)) {
        context.report({ node, messageId: "anyCallbackType", data: { url: URL } });
      }
    };

    return {
      TSFunctionType: reportIfAnyCallback,
      TSMethodSignature: reportIfAnyCallback,
      TSCallSignatureDeclaration: reportIfAnyCallback,
    };
  },
});
