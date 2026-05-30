import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

type ParamsNode = TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression;

/**
 * Checks function parameters for `any` types and reports violations.
 * Skips TSParameterProperty nodes (handled separately).
 */
export function checkAnyParams(
  params: readonly unknown[],
  context: TSESLint.RuleContext<string, unknown[]>,
  messageId: string
) {
  for (const param of params) {
    if ((param as { type: string }).type === "TSParameterProperty") continue;

    const base =
      (param as { type: string }).type === "AssignmentPattern"
        ? (param as { left: { name?: string; typeAnnotation?: { typeAnnotation?: { type: string } } } }).left
        : param;

    if (
      (base as { typeAnnotation?: { typeAnnotation?: { type: string } } })?.typeAnnotation?.typeAnnotation?.type === "TSAnyKeyword"
    ) {
      const paramName =
        (base as { name?: string }).name && typeof (base as { name?: string }).name === "string"
          ? (base as { name: string }).name
          : "unnamed";
      context.report({
        node: param as never,
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
