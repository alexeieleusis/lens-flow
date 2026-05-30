import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

type ParamsNode = TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression;

/**
 * Checks function parameters for `any` types and reports violations.
 * Skips TSParameterProperty nodes (handled separately).
 */
export function checkAnyParams(
  params: readonly TSESTree.Parameter[],
  context: TSESLint.RuleContext<string, unknown[]>,
  messageId: string
) {
  for (const param of params) {
    if (param.type === "TSParameterProperty") continue;

    const base = param.type === "AssignmentPattern" ? param.left : param;
    const typeAnnotation =
      "typeAnnotation" in base ? base.typeAnnotation : undefined;

    if (typeAnnotation?.typeAnnotation.type === "TSAnyKeyword") {
      const paramName =
        "name" in base && typeof base.name === "string" ? base.name : "unnamed";
      context.report({
        node: param,
        messageId,
        data: { name: paramName },
      });
    }
  }
}

type TypeNode = TSESTree.TSFunctionType | TSESTree.TSMethodSignature | TSESTree.TSDeclareFunction;

/**
 * Creates a rule listener for concrete function nodes that checks parameters for `any` types.
 */
export function createNoAnyParamChecker(messageId: string) {
  return function noAnyParamChecker(context: TSESLint.RuleContext<string, unknown[]>): TSESLint.RuleListener {
    return {
      FunctionDeclaration(node: ParamsNode) {
        checkAnyParams(node.params, context, messageId);
      },
      FunctionExpression(node: ParamsNode) {
        checkAnyParams(node.params, context, messageId);
      },
      ArrowFunctionExpression(node: ParamsNode) {
        checkAnyParams(node.params, context, messageId);
      },
      TSParameterProperty(node) {
        if (node.parameter.typeAnnotation?.typeAnnotation.type === "TSAnyKeyword") {
          const paramName =
            node.parameter.type === "Identifier"
              ? node.parameter.name
              : "unnamed";
          context.report({
            node,
            messageId,
            data: { name: paramName },
          });
        }
      },
    };
  };
}

/**
 * Creates a rule listener for type-node function signatures that checks parameters for `any` types.
 */
export function createNoAnyParamTypeChecker(messageId: string) {
  return function noAnyParamTypeChecker(context: TSESLint.RuleContext<string, unknown[]>): TSESLint.RuleListener {
    return {
      TSFunctionType(node: TypeNode) {
        checkAnyParams(node.params, context, messageId);
      },
      TSMethodSignature(node: TypeNode) {
        checkAnyParams(node.params, context, messageId);
      },
      TSDeclareFunction(node: TypeNode) {
        checkAnyParams(node.params, context, messageId);
      },
    };
  };
}
