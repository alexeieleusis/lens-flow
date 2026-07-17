import { AST_NODE_TYPES, type TSESTree } from "@typescript-eslint/utils";

function getTypeNameRightmost(typeName: TSESTree.EntityName): string | null {
  let current: TSESTree.Identifier | TSESTree.TSQualifiedName | TSESTree.ThisExpression | null = typeName;
  while (current && current.type === AST_NODE_TYPES.TSQualifiedName) {
    current = current.right;
  }
  if (current && current.type === AST_NODE_TYPES.Identifier) {
    return current.name;
  }
  return null;
}

export function isTypeRefTo(node: TSESTree.Node, paramName: string): boolean {
  return (
    node.type === AST_NODE_TYPES.TSTypeReference &&
    getTypeNameRightmost(node.typeName) === paramName
  );
}

const MAX_DEPTH = 128;

export function containsTypeRef(
  node: TSESTree.Node,
  paramName: string,
  depth: number = 0,
): boolean {
  if (depth > MAX_DEPTH) return false;
  if (isTypeRefTo(node, paramName)) return true;

  switch (node.type) {
    case AST_NODE_TYPES.TSArrayType:
      return containsTypeRef(
        node.elementType,
        paramName,
        depth + 1,
      );
    case AST_NODE_TYPES.TSTupleType:
      return node.elementTypes.some((el) =>
        containsTypeRef(el, paramName, depth + 1),
      );
    case AST_NODE_TYPES.TSUnionType:
    case AST_NODE_TYPES.TSIntersectionType:
      return node.types.some((t) =>
        containsTypeRef(t, paramName, depth + 1),
      );
    case AST_NODE_TYPES.TSTypeReference: {
      if (node.typeArguments) {
        return node.typeArguments.params.some((arg) =>
          containsTypeRef(arg, paramName, depth + 1),
        );
      }
      return false;
    }
    case AST_NODE_TYPES.TSConditionalType: {
      return (
        containsTypeRef(node.checkType, paramName, depth + 1) ||
        containsTypeRef(node.extendsType, paramName, depth + 1) ||
        containsTypeRef(node.trueType, paramName, depth + 1) ||
        containsTypeRef(node.falseType, paramName, depth + 1)
      );
    }
    case AST_NODE_TYPES.TSIndexedAccessType: {
      return (
        containsTypeRef(node.objectType, paramName, depth + 1) ||
        containsTypeRef(node.indexType, paramName, depth + 1)
      );
    }
    case AST_NODE_TYPES.TSRestType:
    case AST_NODE_TYPES.TSOptionalType:
      return containsTypeRef(
        node.typeAnnotation,
        paramName,
        depth + 1,
      );
    case AST_NODE_TYPES.TSMappedType: {
      return (
        (node.typeAnnotation ? containsTypeRef(node.typeAnnotation, paramName, depth + 1) : false) ||
        (node.nameType ? containsTypeRef(node.nameType, paramName, depth + 1) : false) ||
        (node.typeParameter.constraint
          ? containsTypeRef(node.typeParameter.constraint, paramName, depth + 1)
          : false) ||
        (node.typeParameter.default
          ? containsTypeRef(node.typeParameter.default, paramName, depth + 1)
          : false)
      );
    }
    case AST_NODE_TYPES.TSTypeOperator: {
      if (node.operator === "keyof") {
        return false;
      }
      return containsTypeRef(node.typeAnnotation!, paramName, depth + 1);
    }
    case AST_NODE_TYPES.TSFunctionType:
    case AST_NODE_TYPES.TSConstructorType: {
      return (
        node.params.some((p) => {
          const tp = paramTypeAnnotation(p);
          return tp ? containsTypeRef(tp, paramName, depth + 1) : false;
        }) ||
        (node.returnType?.typeAnnotation
          ? containsTypeRef(node.returnType.typeAnnotation, paramName, depth + 1)
          : false)
      );
    }
    case AST_NODE_TYPES.TSTypeLiteral:
      return node.members.some((m) =>
        memberContainsTypeRef(m, paramName, depth + 1),
      );
    default:
      return false;
  }
}

function memberContainsTypeRef(
  member: TSESTree.TypeElement,
  paramName: string,
  depth: number,
): boolean {
  if (member.type === AST_NODE_TYPES.TSMethodSignature) {
    const m = member as TSESTree.TSMethodSignature;
    return (
      (m.returnType?.typeAnnotation
        ? containsTypeRef(m.returnType.typeAnnotation, paramName, depth)
        : false) ||
      m.params.some((p) => {
        const tp = paramTypeAnnotation(p);
        return tp ? containsTypeRef(tp, paramName, depth) : false;
      })
    );
  }
  if (member.type === AST_NODE_TYPES.TSPropertySignature) {
    const p = member as TSESTree.TSPropertySignature;
    return p.typeAnnotation?.typeAnnotation
      ? containsTypeRef(p.typeAnnotation.typeAnnotation, paramName, depth)
      : false;
  }
  if (member.type === AST_NODE_TYPES.TSIndexSignature) {
    return (
      (member.typeAnnotation?.typeAnnotation
        ? containsTypeRef(member.typeAnnotation.typeAnnotation, paramName, depth)
        : false) ||
      member.parameters.some((p) => {
        const tp = paramTypeAnnotation(p);
        return tp ? containsTypeRef(tp, paramName, depth) : false;
      })
    );
  }
  return false;
}

/** Check if paramName appears in output (contravariant-safe) positions within a type. */
export function containsTypeRefInOutput(
  node: TSESTree.Node,
  paramName: string,
  depth: number = 0,
): boolean {
  if (depth > MAX_DEPTH) return false;
  if (isTypeRefTo(node, paramName)) return true;

  switch (node.type) {
    case AST_NODE_TYPES.TSTypeReference: {
      if (node.typeArguments) {
        return node.typeArguments.params.some((arg) =>
          containsTypeRefInOutput(arg, paramName, depth + 1),
        );
      }
      return false;
    }
    case AST_NODE_TYPES.TSArrayType:
      return containsTypeRefInOutput(
        node.elementType,
        paramName,
        depth + 1,
      );
    case AST_NODE_TYPES.TSTupleType:
      return node.elementTypes.some((el) =>
        containsTypeRefInOutput(el, paramName, depth + 1),
      );
    case AST_NODE_TYPES.TSUnionType:
    case AST_NODE_TYPES.TSIntersectionType:
      return node.types.some((m) =>
        containsTypeRefInOutput(m, paramName, depth + 1),
      );
    case AST_NODE_TYPES.TSRestType:
    case AST_NODE_TYPES.TSOptionalType:
      return containsTypeRefInOutput(
        node.typeAnnotation,
        paramName,
        depth + 1,
      );
    case AST_NODE_TYPES.TSFunctionType: {
      return node.returnType?.typeAnnotation
        ? containsTypeRefInOutput(node.returnType.typeAnnotation, paramName, depth + 1)
        : false;
    }
    case AST_NODE_TYPES.TSConstructorType: {
      return node.returnType?.typeAnnotation
        ? containsTypeRefInOutput(node.returnType.typeAnnotation, paramName, depth + 1)
        : false;
    }
    case AST_NODE_TYPES.TSConditionalType: {
      return (
        (node.trueType ? containsTypeRefInOutput(node.trueType, paramName, depth + 1) : false) ||
        (node.falseType ? containsTypeRefInOutput(node.falseType, paramName, depth + 1) : false)
      );
    }
    case AST_NODE_TYPES.TSIndexedAccessType: {
      return containsTypeRefInOutput(node.objectType, paramName, depth + 1);
    }
    case AST_NODE_TYPES.TSMappedType: {
      return (
        (node.typeAnnotation
          ? containsTypeRefInOutput(node.typeAnnotation, paramName, depth + 1)
          : false) ||
        (node.typeParameter.constraint
          ? containsTypeRefInOutput(node.typeParameter.constraint, paramName, depth + 1)
          : false) ||
        (node.typeParameter.default
          ? containsTypeRefInOutput(node.typeParameter.default, paramName, depth + 1)
          : false)
      );
    }
    case AST_NODE_TYPES.TSTypeOperator: {
      if (node.operator === "keyof") {
        return false;
      }
      return containsTypeRefInOutput(node.typeAnnotation!, paramName, depth + 1);
    }
    case AST_NODE_TYPES.TSTypeLiteral:
      return node.members.some((m) =>
        memberContainsOutputRef(m, paramName, depth + 1),
      );
    default:
      return false;
  }
}

function memberContainsOutputRef(
  member: TSESTree.TypeElement,
  paramName: string,
  depth: number,
): boolean {
  if (member.type === AST_NODE_TYPES.TSMethodSignature) {
    const m = member as TSESTree.TSMethodSignature;
    return m.returnType?.typeAnnotation
      ? containsTypeRefInOutput(m.returnType.typeAnnotation, paramName, depth)
      : false;
  }
  if (member.type === AST_NODE_TYPES.TSPropertySignature) {
    const p = member as TSESTree.TSPropertySignature;
    return p.typeAnnotation?.typeAnnotation
      ? containsTypeRefInOutput(p.typeAnnotation.typeAnnotation, paramName, depth)
      : false;
  }
  if (member.type === AST_NODE_TYPES.TSIndexSignature) {
    return member.typeAnnotation?.typeAnnotation
      ? containsTypeRefInOutput(member.typeAnnotation.typeAnnotation, paramName, depth)
      : false;
  }
  if (member.type === AST_NODE_TYPES.TSCallSignatureDeclaration) {
    const c = member as TSESTree.TSCallSignatureDeclaration;
    return c.returnType?.typeAnnotation
      ? containsTypeRefInOutput(c.returnType.typeAnnotation, paramName, depth)
      : false;
  }
  if (member.type === AST_NODE_TYPES.TSConstructSignatureDeclaration) {
    const c = member as TSESTree.TSConstructSignatureDeclaration;
    return c.returnType?.typeAnnotation
      ? containsTypeRefInOutput(c.returnType.typeAnnotation, paramName, depth)
      : false;
  }
  return false;
}

function innerParamTypeAnnotation(param: TSESTree.Node): TSESTree.Node | undefined {
  if (param.type === AST_NODE_TYPES.Identifier) {
    return param.typeAnnotation?.typeAnnotation;
  }
  if (param.type === AST_NODE_TYPES.RestElement) {
    return param.typeAnnotation?.typeAnnotation || innerParamTypeAnnotation(param.argument);
  }
  if (
    param.type === AST_NODE_TYPES.ObjectPattern ||
    param.type === AST_NODE_TYPES.ArrayPattern
  ) {
    return param.typeAnnotation?.typeAnnotation;
  }
  return undefined;
}

export function paramTypeAnnotation(param: TSESTree.Node): TSESTree.Node | undefined {
  if (param.type === AST_NODE_TYPES.AssignmentPattern) {
    return param.typeAnnotation?.typeAnnotation || innerParamTypeAnnotation(param.left);
  }
  if (param.type === AST_NODE_TYPES.TSParameterProperty) {
    return innerParamTypeAnnotation(param.parameter);
  }
  return innerParamTypeAnnotation(param);
}

function paramsContainTypeRef(
  params: TSESTree.Parameter[],
  paramName: string,
): boolean {
  return params.some((p) => {
    const ann = paramTypeAnnotation(p);
    return ann ? containsTypeRef(ann, paramName) : false;
  });
}

export function paramsContainAnyTypeRef(
  params: TSESTree.Parameter[],
  names: string[],
): boolean {
  return params.some((p) => {
    const ann = paramTypeAnnotation(p);
    if (!ann) return false;
    return names.some((name) => containsTypeRef(ann, name));
  });
}

/** Recursively check if a property type has function/constructor params referencing paramName.
 * Recurses through TSUnionType, TSIntersectionType, and TSParenthesizedType wrappers. */
function propertyTypeHasInputRef(
  node: TSESTree.Node,
  paramName: string,
): boolean {
  switch (node.type) {
    case AST_NODE_TYPES.TSFunctionType:
      return paramsContainTypeRef(node.params, paramName);
    case AST_NODE_TYPES.TSConstructorType:
      return paramsContainTypeRef(node.params, paramName);
    case AST_NODE_TYPES.TSUnionType:
    case AST_NODE_TYPES.TSIntersectionType:
      return node.types.some((t) => propertyTypeHasInputRef(t, paramName));
    case AST_NODE_TYPES.TSTypeLiteral:
      return node.members.some((m) => {
        if (m.type === AST_NODE_TYPES.TSMethodSignature) {
          return paramsContainTypeRef(
            (m as TSESTree.TSMethodSignature).params,
            paramName,
          );
        }
        if (m.type === AST_NODE_TYPES.TSCallSignatureDeclaration) {
          return paramsContainTypeRef(
            (m as TSESTree.TSCallSignatureDeclaration).params,
            paramName,
          );
        }
        if (m.type === AST_NODE_TYPES.TSConstructSignatureDeclaration) {
          return paramsContainTypeRef(
            (m as TSESTree.TSConstructSignatureDeclaration).params,
            paramName,
          );
        }
        if (m.type === AST_NODE_TYPES.TSPropertySignature) {
          const inner = (m as TSESTree.TSPropertySignature).typeAnnotation
            ?.typeAnnotation;
          return inner ? propertyTypeHasInputRef(inner, paramName) : false;
        }
        return false;
      });
    default:
      // TSParenthesizedType exists at runtime but isn't in @typescript-eslint's types.
      if ((node as any).type === "TSParenthesizedType") {
        return propertyTypeHasInputRef((node as any).typeAnnotation, paramName);
      }
      return false;
  }
}

export function isUsedAsInputInBody(
  body: TSESTree.TSInterfaceBody | TSESTree.TSTypeLiteral,
  paramName: string,
): boolean {
  const members =
    body.type === AST_NODE_TYPES.TSInterfaceBody ? body.body : body.members;

  return members.some((member) => {
    if (member.type === AST_NODE_TYPES.TSMethodSignature) {
      return paramsContainTypeRef(
        (member as TSESTree.TSMethodSignature).params,
        paramName,
      );
    }
    if (member.type === AST_NODE_TYPES.TSPropertySignature) {
      const typeAnn = (member as TSESTree.TSPropertySignature).typeAnnotation
        ?.typeAnnotation;
      if (typeAnn) {
        return propertyTypeHasInputRef(typeAnn, paramName);
      }
    }
    if (member.type === AST_NODE_TYPES.TSCallSignatureDeclaration) {
      return paramsContainTypeRef(member.params, paramName);
    }
    if (member.type === AST_NODE_TYPES.TSConstructSignatureDeclaration) {
      return paramsContainTypeRef(member.params, paramName);
    }
    if (member.type === AST_NODE_TYPES.TSIndexSignature) {
      return member.parameters.some((p) => {
        const tp = paramTypeAnnotation(p);
        return tp ? containsTypeRef(tp, paramName) : false;
      });
    }
    return false;
  });
}

/**
 * Creates an ESLint visitor for TSInterfaceDeclaration and
 * TSTypeAliasDeclaration, extracting type params and body to pass
 * to the provided check function.
 */
export function createVarianceDeclarationVisitor(
  checkFn: (
    typeParams: TSESTree.TSTypeParameter[],
    body: TSESTree.TSInterfaceBody | TSESTree.TSTypeLiteral,
  ) => void,
): {
  TSInterfaceDeclaration: (node: TSESTree.TSInterfaceDeclaration) => void;
  TSTypeAliasDeclaration: (node: TSESTree.TSTypeAliasDeclaration) => void;
} {
  return {
    TSInterfaceDeclaration(node) {
      if (node.typeParameters && node.body) {
        checkFn(node.typeParameters.params, node.body);
      }
    },

   TSTypeAliasDeclaration(node) {
      if (
        node.typeParameters &&
        node.typeAnnotation.type === AST_NODE_TYPES.TSTypeLiteral
      ) {
        checkFn(
          node.typeParameters.params,
          node.typeAnnotation,
        );
      }
    },
  };
}

export function isUsedAsOutputInBody(
  body: TSESTree.TSInterfaceBody | TSESTree.TSTypeLiteral,
  paramName: string,
): boolean {
  const members =
    body.type === AST_NODE_TYPES.TSInterfaceBody ? body.body : body.members;

  return members.some((member) =>
    memberContainsOutputRef(member, paramName, 0),
  );
}
