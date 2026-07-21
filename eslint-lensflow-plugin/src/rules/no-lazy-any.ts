import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { containsAnyType } from "../utils/no-any-param-checker.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T47-gradual-typing.md");

function getParamTypeAnnotation(
  param: TSESTree.Parameter,
): TSESTree.TypeNode | undefined {
  if (param.type === "TSParameterProperty") {
    return param.parameter.typeAnnotation?.typeAnnotation;
  }
  if (param.type === "AssignmentPattern") {
    return param.left.typeAnnotation?.typeAnnotation;
  }
  if (param.type === "RestElement") {
    if (param.typeAnnotation?.typeAnnotation)
      return param.typeAnnotation.typeAnnotation;
    if (param.argument.type === "Identifier")
      return param.argument.typeAnnotation?.typeAnnotation;
    return undefined;
  }
  if ("typeAnnotation" in param && param.typeAnnotation) {
    return param.typeAnnotation.typeAnnotation;
  }
  return undefined;
}

export default createRule({
  name: "no-lazy-any",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow functions where every parameter and the return type are `any`.",
    },
    messages: {
      lazyAny:
        "Function uses `any` for all parameters and return type. Replace with proper types instead of deferring typing work. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"lazyAny", []>) {
    function checkFunctionNode(
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression
        | TSESTree.TSFunctionType
        | TSESTree.TSDeclareFunction
        | TSESTree.TSMethodSignature
        | TSESTree.TSCallSignatureDeclaration,
    ) {
      const params = node.params;

      if (params.length === 0) return;

      const allParamsAny = params.every((p) => {
        const typeAnn = getParamTypeAnnotation(p);
        return typeAnn !== undefined && containsAnyType(typeAnn);
      });

      if (!allParamsAny) return;

      const returnTypeAnn = node.returnType?.typeAnnotation;
      if (returnTypeAnn && containsAnyType(returnTypeAnn)) {
        context.report({ node, messageId: "lazyAny", data: { url: URL } });
      }
    }

    return {
      FunctionDeclaration: checkFunctionNode,
      FunctionExpression: checkFunctionNode,
      ArrowFunctionExpression: checkFunctionNode,
      TSFunctionType: checkFunctionNode,
      TSDeclareFunction: checkFunctionNode,
      TSMethodSignature: checkFunctionNode,
      TSCallSignatureDeclaration: checkFunctionNode,
    };
  },
});
