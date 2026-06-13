import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

function isAnyType(node: TSESTree.TypeNode): boolean {
  return node.type === "TSAnyKeyword";
}

function getParamTypeAnnotation(
  param: TSESTree.Parameter,
): TSESTree.TypeNode | undefined {
  const base =
    param.type === "TSParameterProperty" ? param.parameter : param;
  if ("typeAnnotation" in base && base.typeAnnotation) {
    return base.typeAnnotation.typeAnnotation;
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
        "Function uses `any` for all parameters and return type. Replace with proper types instead of deferring typing work. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T47-gradual-typing.md",
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
        | TSESTree.TSFunctionType,
    ) {
      const params = node.params;

      if (params.length === 0) return;

      const allParamsAny = params.every((p) => {
        const typeAnn = getParamTypeAnnotation(p);
        return typeAnn !== undefined && isAnyType(typeAnn);
      });

      if (!allParamsAny) return;

      const returnTypeAnn = node.returnType?.typeAnnotation;
      if (returnTypeAnn && isAnyType(returnTypeAnn)) {
        context.report({ node, messageId: "lazyAny" });
      }
    }

    return {
      FunctionDeclaration: checkFunctionNode,
      FunctionExpression: checkFunctionNode,
      ArrowFunctionExpression: checkFunctionNode,
      TSFunctionType: checkFunctionNode,
    };
  },
});
