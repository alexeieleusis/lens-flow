import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

type ParamsNode =
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression
  | TSESTree.ArrowFunctionExpression;

/**
 * Extracts the type annotation from a parameter node, unwrapping
 * AssignmentPattern and RestElement wrappers.
 */
function getParamTypeAnnotation(
  param: TSESTree.Parameter,
): TSESTree.TypeNode | undefined {
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
}

function checkFunctionLikeParams(params: TSESTree.Parameter[]): boolean {
  return params.some((p) => {
    const typeAnn = getParamTypeAnnotation(p);
    return typeAnn != null && containsAnyType(typeAnn);
  });
}

function checkFunctionLikeReturnType(node: {
  returnType?: { typeAnnotation?: TSESTree.TypeNode };
}): boolean {
  if (node.returnType?.typeAnnotation) {
    return containsAnyType(node.returnType.typeAnnotation);
  }
  return false;
}

function checkTypeLiteralMembers(members: TSESTree.TypeElement[]): boolean {
  return members.some((member) => {
    if (
      member.type === "TSPropertySignature" &&
      member.typeAnnotation?.typeAnnotation
    ) {
      return containsAnyType(member.typeAnnotation.typeAnnotation);
    }
    if (
      member.type === "TSCallSignatureDeclaration" ||
      member.type === "TSConstructSignatureDeclaration"
    ) {
      if (checkFunctionLikeParams(member.params)) return true;
      return checkFunctionLikeReturnType(member);
    }
    return false;
  });
}

const typeHandlers: Record<string, (node: TSESTree.TypeNode) => boolean> = {
  TSAnyKeyword: () => true,
  TSUnionType: (node) =>
    (node as TSESTree.TSUnionType).types.some((m) => containsAnyType(m)),
  TSIntersectionType: (node) =>
    (node as TSESTree.TSIntersectionType).types.some((m) => containsAnyType(m)),
  TSArrayType: (node) =>
    containsAnyType((node as TSESTree.TSArrayType).elementType),
  TSTupleType: (node) =>
    (node as TSESTree.TSTupleType).elementTypes.some((e) => containsAnyType(e)),
  TSTypeReference: (node) => {
    const ref = node as TSESTree.TSTypeReference;
    if (ref.typeArguments)
      return ref.typeArguments.params.some((p) => containsAnyType(p));
    return false;
  },
  TSRestType: (node) =>
    containsAnyType((node as TSESTree.TSRestType).typeAnnotation),
  TSOptionalType: (node) =>
    containsAnyType((node as TSESTree.TSOptionalType).typeAnnotation),
  TSIndexedAccessType: (node) => {
    const acc = node as TSESTree.TSIndexedAccessType;
    return containsAnyType(acc.objectType) || containsAnyType(acc.indexType);
  },
  TSConditionalType: (node) => {
    const ct = node as TSESTree.TSConditionalType;
    return (
      containsAnyType(ct.checkType) ||
      containsAnyType(ct.extendsType) ||
      containsAnyType(ct.trueType) ||
      containsAnyType(ct.falseType)
    );
  },
  TSFunctionType: (node) => {
    const fn = node as TSESTree.TSFunctionType;
    return (
      checkFunctionLikeParams(fn.params) || checkFunctionLikeReturnType(fn)
    );
  },
  TSConstructorType: (node) => {
    const fn = node as TSESTree.TSConstructorType;
    return (
      checkFunctionLikeParams(fn.params) || checkFunctionLikeReturnType(fn)
    );
  },
  TSMappedType: (node) => {
    const mt = node as TSESTree.TSMappedType;
    return (
      containsAnyType(mt.constraint) ||
      (mt.nameType != null && containsAnyType(mt.nameType)) ||
      (mt.typeAnnotation != null && containsAnyType(mt.typeAnnotation))
    );
  },
  TSImportType: (node) => {
    const imp = node as TSESTree.TSImportType;
    if (imp.typeArguments)
      return imp.typeArguments.params.some((p) => containsAnyType(p));
    return false;
  },
  TSTypeOperator: (node) => {
    const op = node as TSESTree.TSTypeOperator;
    if (op.typeAnnotation) return containsAnyType(op.typeAnnotation);
    return false;
  },
  TSTypeLiteral: (node) =>
    checkTypeLiteralMembers((node as TSESTree.TSTypeLiteral).members),
};

/**
 * Recursively checks whether a type node contains `any`.
 * Unwraps unions, intersections, and other type wrappers.
 */
export function containsAnyType(node: TSESTree.TypeNode): boolean {
  const handler = typeHandlers[node.type];
  return handler ? handler(node) : false;
}

function shouldSkipParam(
  param: TSESTree.Parameter,
  typeNode: TSESTree.TypeNode | undefined,
): boolean {
  if (param.type === "TSParameterProperty") return true;
  if (
    typeNode?.type === "TSFunctionType" ||
    typeNode?.type === "TSConstructorType"
  )
    return true;
  return false;
}

function extractParamName(
  param: TSESTree.Parameter,
  sourceCode: TSESLint.SourceCode,
): string {
  let inner: TSESTree.Node = param;
  if (param.type === "AssignmentPattern") inner = param.left;
  if (inner.type === "RestElement") inner = inner.argument;
  return inner.type === "Identifier" ? inner.name : sourceCode.getText(param);
}

/**
 * Checks function parameters for `any` types and reports violations.
 * Skips TSParameterProperty nodes (handled separately).
 */
export function checkAnyParams(
  params: readonly TSESTree.Parameter[],
  context: TSESLint.RuleContext<string, unknown[]>,
  messageId: string,
  extraData?: Record<string, unknown>,
) {
  for (const param of params) {
    const typeNode = getParamTypeAnnotation(param);
    if (shouldSkipParam(param, typeNode)) continue;
    if (typeNode && containsAnyType(typeNode)) {
      context.report({
        node: param,
        messageId,
        data: {
          name: extractParamName(param, context.sourceCode),
          ...extraData,
        },
      });
    }
  }
}

type TypeNode =
  | TSESTree.TSFunctionType
  | TSESTree.TSMethodSignature
  | TSESTree.TSDeclareFunction
  | TSESTree.TSCallSignatureDeclaration
  | TSESTree.TSConstructorType;

/**
 * Creates a rule listener for concrete function nodes that checks parameters for `any` types.
 */
export function createNoAnyParamChecker(
  messageId: string,
  extraData?: Record<string, unknown>,
) {
  return function noAnyParamChecker(
    context: TSESLint.RuleContext<string, unknown[]>,
  ): TSESLint.RuleListener {
    return {
      FunctionDeclaration(node: ParamsNode) {
        checkAnyParams(node.params, context, messageId, extraData);
      },
      FunctionExpression(node: ParamsNode) {
        if (node.parent?.type === "MethodDefinition") return;
        checkAnyParams(node.params, context, messageId, extraData);
      },
      ArrowFunctionExpression(node: ParamsNode) {
        checkAnyParams(node.params, context, messageId, extraData);
      },
      MethodDefinition(node: TSESTree.MethodDefinition) {
        checkAnyParams(node.value.params, context, messageId, extraData);
      },
      TSParameterProperty(node) {
        const inner = node.parameter;
        if (inner.type !== "Identifier") return;
        if (
          inner.typeAnnotation?.typeAnnotation &&
          containsAnyType(inner.typeAnnotation.typeAnnotation)
        ) {
          const paramName = inner.name;
          context.report({
            node,
            messageId,
            data: { name: paramName, ...extraData },
          });
        }
      },
    };
  };
}

/**
 * Creates a rule listener for type-node function signatures that checks parameters for `any` types.
 */
export function createNoAnyParamTypeChecker(
  messageId: string,
  extraData?: Record<string, unknown>,
) {
  return function noAnyParamTypeChecker(
    context: TSESLint.RuleContext<string, unknown[]>,
  ): TSESLint.RuleListener {
    return {
      TSFunctionType(node: TypeNode) {
        checkAnyParams(node.params, context, messageId, extraData);
      },
      TSMethodSignature(node: TypeNode) {
        checkAnyParams(node.params, context, messageId, extraData);
      },
      TSDeclareFunction(node: TypeNode) {
        checkAnyParams(node.params, context, messageId, extraData);
      },
      TSCallSignatureDeclaration(node: TypeNode) {
        checkAnyParams(node.params, context, messageId, extraData);
      },
      TSConstructorType(node: TSESTree.TSConstructorType) {
        checkAnyParams(node.params, context, messageId, extraData);
      },
    };
  };
}
