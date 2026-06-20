import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

type ParamsNode = TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression;

/**
 * Recursively checks whether a type node contains `any`.
 * Unwraps unions, intersections, and other type wrappers.
 */
function containsAnyType(node: TSESTree.TypeNode): boolean {
  if (node.type === "TSAnyKeyword") return true;

  if (node.type === "TSUnionType" || node.type === "TSIntersectionType") {
    return node.types.some((member) => containsAnyType(member));
  }

  if (node.type === "TSArrayType") {
    return containsAnyType(node.elementType);
  }

  if (node.type === "TSTupleType") {
    return node.elementTypes.some((element) => containsAnyType(element));
  }

  if (node.type === "TSTypeReference" && node.typeArguments) {
    return node.typeArguments.params.some((param) => containsAnyType(param));
  }

  if (node.type === "TSRestType" || node.type === "TSOptionalType") {
    return containsAnyType(node.typeAnnotation);
  }

  if (node.type === "TSIndexedAccessType") {
    return containsAnyType(node.objectType) || containsAnyType(node.indexType);
  }

  if (node.type === "TSConditionalType") {
    return (
      containsAnyType(node.checkType) ||
      containsAnyType(node.extendsType) ||
      containsAnyType(node.trueType) ||
      containsAnyType(node.falseType)
    );
  }

  if (node.type === "TSFunctionType" || node.type === "TSConstructorType") {
    if (node.params.some((p) => {
      const typeAnn = p.typeAnnotation?.typeAnnotation;
      return typeAnn && containsAnyType(typeAnn);
    })) {
      return true;
    }
    if (node.returnType?.typeAnnotation) {
      return containsAnyType(node.returnType.typeAnnotation);
    }
    return false;
  }

  if (node.type === "TSMappedType") {
    return (
      containsAnyType(node.constraint) ||
      (node.nameType != null && containsAnyType(node.nameType)) ||
      (node.typeAnnotation != null && containsAnyType(node.typeAnnotation))
    );
  }

  if (node.type === "TSImportType" && node.typeArguments) {
    return node.typeArguments.params.some((param) => containsAnyType(param));
  }

  if (node.type === "TSTypeOperator" && node.typeAnnotation) {
    return containsAnyType(node.typeAnnotation);
  }

  if (node.type === "TSParenthesizedType") {
    return containsAnyType(node.typeAnnotation);
  }

  if (node.type === "TSTypeLiteral") {
    return node.members.some((member) => {
      if (member.type === "TSPropertySignature" && member.typeAnnotation?.typeAnnotation) {
        return containsAnyType(member.typeAnnotation.typeAnnotation);
      }
      if (member.type === "TSCallSignatureDeclaration" || member.type === "TSConstructSignatureDeclaration") {
        if (member.params.some((p) => {
          const typeAnn = p.typeAnnotation?.typeAnnotation;
          return typeAnn && containsAnyType(typeAnn);
        })) return true;
        if (member.returnType?.typeAnnotation) {
          return containsAnyType(member.returnType.typeAnnotation);
        }
      }
      return false;
    });
  }

  return false;
}

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
    const typeNode = base.typeAnnotation?.typeAnnotation;

    if (typeNode && containsAnyType(typeNode)) {
      const paramName =
        "name" in base && typeof base.name === "string" ? base.name : context.sourceCode.getText(param);
      context.report({
        node: param,
        messageId,
        data: { name: paramName },
      });
    }
  }
}

type TypeNode = TSESTree.TSFunctionType | TSESTree.TSMethodSignature | TSESTree.TSDeclareFunction | TSESTree.TSCallSignatureDeclaration;

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
        if (node.parameter.typeAnnotation?.typeAnnotation && containsAnyType(node.parameter.typeAnnotation.typeAnnotation)) {
          const paramName =
            "name" in node.parameter && typeof node.parameter.name === "string"
              ? node.parameter.name
              : context.sourceCode.getText(node.parameter);
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
      TSCallSignatureDeclaration(node: TypeNode) {
        checkAnyParams(node.params, context, messageId);
      },
    };
  };
}
