import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

type ParamsNode = TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression;

/**
 * Extracts the type annotation from a parameter node, unwrapping
 * AssignmentPattern and RestElement wrappers.
 */
function getParamTypeAnnotation(param: TSESTree.Parameter): TSESTree.TypeNode | undefined {
  if (param.type === "AssignmentPattern") {
    if (param.left.type === "Identifier") {
      return param.left.typeAnnotation?.typeAnnotation;
    }
    return;
  }
  if (param.type === "RestElement") {
    if (param.typeAnnotation?.typeAnnotation) {
      return param.typeAnnotation.typeAnnotation;
    }
    if (param.argument.type === "Identifier") {
      return param.argument.typeAnnotation?.typeAnnotation;
    }
    return;
  }
  if (param.type === "Identifier") {
    return param.typeAnnotation?.typeAnnotation;
  }
  if (param.type === "ObjectPattern" || param.type === "ArrayPattern") {
    return param.typeAnnotation?.typeAnnotation;
  }
  return;
}

/**
 * Recursively checks whether a type node contains `any`.
 * Unwraps unions, intersections, and other type wrappers.
 */
export function containsAnyType(node: TSESTree.TypeNode): boolean {
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
      const typeAnn = getParamTypeAnnotation(p);
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

  if (node.type === "TSTypeLiteral") {
    return node.members.some((member) => {
      if (member.type === "TSPropertySignature" && member.typeAnnotation?.typeAnnotation) {
        return containsAnyType(member.typeAnnotation.typeAnnotation);
      }
      if (member.type === "TSCallSignatureDeclaration" || member.type === "TSConstructSignatureDeclaration") {
        if (member.params.some((p) => {
          const typeAnn = getParamTypeAnnotation(p);
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

function shouldSkipParam(param: TSESTree.Parameter, typeNode: TSESTree.TypeNode | undefined): boolean {
  if (param.type === "TSParameterProperty") return true;
  if (typeNode?.type === "TSFunctionType" || typeNode?.type === "TSConstructorType") return true;
  return false;
}

function extractParamName(param: TSESTree.Parameter, sourceCode: TSESLint.SourceCode): string {
  let inner: TSESTree.Node = param;
  if (param.type === "AssignmentPattern") inner = param.left;
  if (inner.type === "RestElement") inner = (inner as TSESTree.RestElement).argument;
  return inner.type === "Identifier" ? (inner as TSESTree.Identifier).name : sourceCode.getText(param);
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
    const typeNode = getParamTypeAnnotation(param);
    if (shouldSkipParam(param, typeNode)) continue;
    if (typeNode && containsAnyType(typeNode)) {
      context.report({
        node: param,
        messageId,
        data: { name: extractParamName(param, context.sourceCode) },
      });
    }
  }
}

type TypeNode = TSESTree.TSFunctionType | TSESTree.TSMethodSignature | TSESTree.TSDeclareFunction | TSESTree.TSCallSignatureDeclaration | TSESTree.TSConstructorType;

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
        if (node.parent?.type === "MethodDefinition") return;
        checkAnyParams(node.params, context, messageId);
      },
      ArrowFunctionExpression(node: ParamsNode) {
        checkAnyParams(node.params, context, messageId);
      },
      MethodDefinition(node: TSESTree.MethodDefinition) {
        checkAnyParams(node.value.params, context, messageId);
      },
      TSParameterProperty(node) {
        const inner = node.parameter;
        if (inner.type !== "Identifier") return;
        if (inner.typeAnnotation?.typeAnnotation && containsAnyType(inner.typeAnnotation.typeAnnotation)) {
          const paramName = inner.name;
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
      TSConstructorType(node: TSESTree.TSConstructorType) {
        checkAnyParams(node.params, context, messageId);
      },
    };
  };
}
