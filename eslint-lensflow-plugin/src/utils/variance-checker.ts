import { AST_NODE_TYPES, type TSESTree } from "@typescript-eslint/utils";

export function isTypeRefTo(node: TSESTree.Node, paramName: string): boolean {
  return (
    node.type === AST_NODE_TYPES.TSTypeReference &&
    node.typeName.type === AST_NODE_TYPES.Identifier &&
    node.typeName.name === paramName
  );
}

export function containsTypeRef(
  node: TSESTree.Node,
  paramName: string,
): boolean {
  if (isTypeRefTo(node, paramName)) return true;

  switch (node.type) {
    case AST_NODE_TYPES.TSArrayType:
      return containsTypeRef(
        node.elementType,
        paramName,
      );
    case AST_NODE_TYPES.TSTupleType:
      return node.elementTypes.some((el) =>
        containsTypeRef(el, paramName),
      );
    case AST_NODE_TYPES.TSUnionType:
    case AST_NODE_TYPES.TSIntersectionType:
      return node.types.some((t) =>
        containsTypeRef(t, paramName),
      );
    case AST_NODE_TYPES.TSTypeReference: {
      if (node.typeArguments) {
        return node.typeArguments.params.some((arg) =>
          containsTypeRef(arg, paramName),
        );
      }
      return false;
    }
    case AST_NODE_TYPES.TSConditionalType: {
      return (
        containsTypeRef(node.checkType, paramName) ||
        containsTypeRef(node.extendsType, paramName) ||
        containsTypeRef(node.trueType, paramName) ||
        containsTypeRef(node.falseType, paramName)
      );
    }
    case AST_NODE_TYPES.TSIndexedAccessType: {
      return (
        containsTypeRef(node.objectType, paramName) ||
        containsTypeRef(node.indexType, paramName)
      );
    }
    case AST_NODE_TYPES.TSRestType:
    case AST_NODE_TYPES.TSOptionalType:
      return containsTypeRef(
        node.typeAnnotation,
        paramName,
      );
    case AST_NODE_TYPES.TSMappedType: {
      return (
        (node.typeAnnotation ? containsTypeRef(node.typeAnnotation, paramName) : false) ||
        (node.nameType ? containsTypeRef(node.nameType, paramName) : false)
      );
    }
    case AST_NODE_TYPES.TSTypeOperator: {
      const to = node;
      return containsTypeRef(to.typeAnnotation!, paramName);
    }
    case AST_NODE_TYPES.TSFunctionType:
    case AST_NODE_TYPES.TSConstructorType: {
      return (
        node.params.some((p) => {
          const tp = paramTypeAnnotation(p);
          return tp ? containsTypeRef(tp, paramName) : false;
        }) ||
        (node.returnType?.typeAnnotation
          ? containsTypeRef(node.returnType.typeAnnotation, paramName)
          : false)
      );
    }
    case AST_NODE_TYPES.TSTypeLiteral:
      return node.members.some((m) =>
        memberContainsTypeRef(m, paramName),
      );
    default:
      return false;
  }
}

function memberContainsTypeRef(
  member: TSESTree.TypeElement,
  paramName: string,
): boolean {
  if (member.type === AST_NODE_TYPES.TSMethodSignature) {
    const m = member as TSESTree.TSMethodSignature;
    return (
      (m.returnType?.typeAnnotation
        ? containsTypeRef(m.returnType.typeAnnotation, paramName)
        : false) ||
      m.params.some((p) => {
        const tp = paramTypeAnnotation(p);
        return tp ? containsTypeRef(tp, paramName) : false;
      })
    );
  }
  if (member.type === AST_NODE_TYPES.TSPropertySignature) {
    const p = member as TSESTree.TSPropertySignature;
    return p.typeAnnotation?.typeAnnotation
      ? containsTypeRef(p.typeAnnotation.typeAnnotation, paramName)
      : false;
  }
  if (member.type === AST_NODE_TYPES.TSIndexSignature) {
    return (
      (member.typeAnnotation?.typeAnnotation
        ? containsTypeRef(member.typeAnnotation.typeAnnotation, paramName)
        : false) ||
      member.parameters.some((p) => {
        const tp = paramTypeAnnotation(p);
        return tp ? containsTypeRef(tp, paramName) : false;
      })
    );
  }
  return false;
}

/** Check if paramName appears in output (contravariant-safe) positions within a type. */
export function containsTypeRefInOutput(
  node: TSESTree.Node,
  paramName: string,
): boolean {
  if (isTypeRefTo(node, paramName)) return true;

  switch (node.type) {
    case AST_NODE_TYPES.TSTypeReference: {
      if (node.typeArguments) {
        return node.typeArguments.params.some((arg) =>
          containsTypeRefInOutput(arg, paramName),
        );
      }
      return false;
    }
    case AST_NODE_TYPES.TSArrayType:
      return containsTypeRefInOutput(
        node.elementType,
        paramName,
      );
    case AST_NODE_TYPES.TSTupleType:
      return node.elementTypes.some((el) =>
        containsTypeRefInOutput(el, paramName),
      );
    case AST_NODE_TYPES.TSUnionType:
    case AST_NODE_TYPES.TSIntersectionType:
      return node.types.some((m) =>
        containsTypeRefInOutput(m, paramName),
      );
    case AST_NODE_TYPES.TSRestType:
    case AST_NODE_TYPES.TSOptionalType:
      return containsTypeRefInOutput(
        node.typeAnnotation,
        paramName,
      );
    case AST_NODE_TYPES.TSFunctionType: {
      return node.returnType?.typeAnnotation
        ? containsTypeRefInOutput(node.returnType.typeAnnotation, paramName)
        : false;
    }
    case AST_NODE_TYPES.TSConstructorType: {
      const c = node;
      return c.returnType?.typeAnnotation
        ? containsTypeRefInOutput(c.returnType.typeAnnotation, paramName)
        : false;
    }
    case AST_NODE_TYPES.TSConditionalType: {
      return (
        (node.trueType ? containsTypeRefInOutput(node.trueType, paramName) : false) ||
        (node.falseType ? containsTypeRefInOutput(node.falseType, paramName) : false)
      );
    }
    case AST_NODE_TYPES.TSIndexedAccessType: {
      return containsTypeRefInOutput(node.objectType, paramName);
    }
    case AST_NODE_TYPES.TSMappedType: {
      return node.typeAnnotation
        ? containsTypeRefInOutput(node.typeAnnotation, paramName)
        : false;
    }
    case AST_NODE_TYPES.TSTypeOperator: {
      return containsTypeRefInOutput(node.typeAnnotation!, paramName);
    }
    case AST_NODE_TYPES.TSTypeLiteral:
      return node.members.some((m) =>
        memberContainsOutputRef(m, paramName),
      );
    default:
      return false;
  }
}

function memberContainsOutputRef(
  member: TSESTree.TypeElement,
  paramName: string,
): boolean {
  if (member.type === AST_NODE_TYPES.TSMethodSignature) {
    const m = member as TSESTree.TSMethodSignature;
    return m.returnType?.typeAnnotation
      ? containsTypeRefInOutput(m.returnType.typeAnnotation, paramName)
      : false;
  }
  if (member.type === AST_NODE_TYPES.TSPropertySignature) {
    const p = member as TSESTree.TSPropertySignature;
    return p.typeAnnotation?.typeAnnotation
      ? containsTypeRefInOutput(p.typeAnnotation.typeAnnotation, paramName)
      : false;
  }
  if (member.type === AST_NODE_TYPES.TSIndexSignature) {
    return member.typeAnnotation?.typeAnnotation
      ? containsTypeRefInOutput(member.typeAnnotation.typeAnnotation, paramName)
      : false;
  }
  return false;
}

export function paramTypeAnnotation(param: TSESTree.Node): TSESTree.Node | undefined {
  if (param.type === AST_NODE_TYPES.Identifier) {
    return param.typeAnnotation?.typeAnnotation;
  }
  if (param.type === AST_NODE_TYPES.RestElement) {
    return param.typeAnnotation?.typeAnnotation;
  }
  if (
    param.type === AST_NODE_TYPES.ObjectPattern ||
    param.type === AST_NODE_TYPES.ArrayPattern
  ) {
    return param.typeAnnotation?.typeAnnotation;
  }
  return undefined;
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
      if (typeAnn?.type === AST_NODE_TYPES.TSFunctionType) {
        return paramsContainTypeRef(typeAnn.params, paramName);
      }
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

  for (const member of members) {
    if (member.type === AST_NODE_TYPES.TSMethodSignature) {
      const m = member as TSESTree.TSMethodSignature;
      const retType = m.returnType?.typeAnnotation;
      if (retType && containsTypeRefInOutput(retType, paramName)) return true;
    } else if (member.type === AST_NODE_TYPES.TSPropertySignature) {
      const p = member as TSESTree.TSPropertySignature;
      const typeAnn = p.typeAnnotation?.typeAnnotation;
      if (typeAnn && containsTypeRefInOutput(typeAnn, paramName)) return true;
    }
  }
  return false;
}
