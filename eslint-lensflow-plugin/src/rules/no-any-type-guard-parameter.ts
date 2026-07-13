import { createRule } from "../utils/rule-creator.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

type FunctionLikeNode =
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression
  | TSESTree.ArrowFunctionExpression
  | TSESTree.TSDeclareFunction
  | TSESTree.TSFunctionType
  | TSESTree.TSCallSignatureDeclaration;

function containsAny(type: TSESTree.TypeNode): boolean {
  switch (type.type) {
    case "TSAnyKeyword":
      return true;
    case "TSArrayType":
      return containsAny(type.elementType);
    case "TSUnionType":
    case "TSIntersectionType":
      return type.types.some(containsAny);
    default:
      return false;
  }
}

function extractTypeAnnotation(
  param: Exclude<TSESTree.Parameter, TSESTree.TSParameterProperty>,
): TSESTree.TypeNode | null {
  if (param.type === "AssignmentPattern") {
    return param.left.typeAnnotation?.typeAnnotation ?? null;
  }
  return param.typeAnnotation?.typeAnnotation ?? null;
}

function checkTypeGuardParam(
  context: TSESLint.RuleContext<"anyTypeGuardParam", []>,
  node: FunctionLikeNode,
) {
  if (
    node.returnType?.typeAnnotation.type === "TSTypePredicate" &&
    node.params.length > 0
  ) {
    let firstParam = node.params[0];
    if (firstParam.type === "TSParameterProperty") {
      firstParam = firstParam.parameter;
    }
    const typeAnnotation = extractTypeAnnotation(firstParam);
    if (typeAnnotation && containsAny(typeAnnotation)) {
      context.report({
        node: typeAnnotation,
        messageId: "anyTypeGuardParam",
      });
    }
  }
}

export default createRule({
  name: "no-any-type-guard-parameter",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow type guard functions that accept `any` instead of `unknown`",
    },
    messages: {
      anyTypeGuardParam:
        "Type guard parameter should be `unknown` not `any`. Using `any` bypasses narrowing even after the guard passes. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T47-gradual-typing.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"anyTypeGuardParam", []>) {
    return {
      FunctionDeclaration(node) {
        checkTypeGuardParam(context, node);
      },
      FunctionExpression(node) {
        checkTypeGuardParam(context, node);
      },
      ArrowFunctionExpression(node) {
        checkTypeGuardParam(context, node);
      },
      TSDeclareFunction(node) {
        checkTypeGuardParam(context, node);
      },
      TSFunctionType(node) {
        checkTypeGuardParam(context, node);
      },
      TSCallSignatureDeclaration(node) {
        checkTypeGuardParam(context, node);
      },
    };
  },
});
