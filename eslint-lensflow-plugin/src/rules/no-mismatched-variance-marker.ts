import { AST_NODE_TYPES, type TSESTree, type TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { isTypeRefTo } from "../utils/variance-checker.js";

function reportIfMatch(
  node: TSESTree.Node,
  paramName: string,
  cb: (ref: TSESTree.TSTypeReference) => void,
): void {
  if (
    node.type === AST_NODE_TYPES.TSTypeReference &&
    node.typeName.type === AST_NODE_TYPES.Identifier &&
    node.typeName.name === paramName
  ) {
    cb(node);
  }
}

function walkInputPositions(
  node: TSESTree.Node,
  paramName: string,
  cb: (ref: TSESTree.TSTypeReference) => void,
): void {
  if (isTypeRefTo(node, paramName)) {
    cb(node as TSESTree.TSTypeReference);
    return;
  }

  switch (node.type) {
    case AST_NODE_TYPES.TSArrayType: {
      walkInputPositions(
        node.elementType,
        paramName,
        cb,
      );
      break;
    }
    case AST_NODE_TYPES.TSTupleType: {
      for (const el of node.elementTypes) {
        walkInputPositions(el, paramName, cb);
      }
      break;
    }
    case AST_NODE_TYPES.TSUnionType:
    case AST_NODE_TYPES.TSIntersectionType: {
      for (const m of node.types) {
        walkInputPositions(m, paramName, cb);
      }
      break;
    }
    case AST_NODE_TYPES.TSRestType:
    case AST_NODE_TYPES.TSOptionalType:
    case AST_NODE_TYPES.TSParenthesizedType: {
      walkInputPositions(
        node.typeAnnotation,
        paramName,
        cb,
      );
      break;
    }
    case AST_NODE_TYPES.TSTypeReference: {
      if (node.typeArguments) {
        for (const arg of node.typeArguments.params) {
          walkInputPositions(arg, paramName, cb);
        }
      }
      break;
    }
    case AST_NODE_TYPES.TSIndexedAccessType: {
      walkInputPositions(
        node.indexType,
        paramName,
        cb,
      );
      break;
    }
    case AST_NODE_TYPES.TSConditionalType: {
      walkInputPositions(
        node.checkType,
        paramName,
        cb,
      );
      if (node.trueType) {
        walkInputPositions(
          node.trueType,
          paramName,
          cb,
        );
      }
      if (node.falseType) {
        walkInputPositions(
          node.falseType,
          paramName,
          cb,
        );
      }
      break;
    }
    case AST_NODE_TYPES.TSMappedType: {
      if (node.typeAnnotation) {
        walkInputPositions(
          node.typeAnnotation,
          paramName,
          cb,
        );
      }
      break;
    }
  }
}

function walkParamAnnotation(
  param: TSESTree.Node,
  paramName: string,
  cb: (ref: TSESTree.TSTypeReference) => void,
): void {
  let typeNode: TSESTree.Node | undefined;
  if (param.type === AST_NODE_TYPES.TSParameterProperty) {
    const inner = param.parameter;
    typeNode = inner.typeAnnotation?.typeAnnotation;
  } else if (
    param.type === AST_NODE_TYPES.Identifier ||
    param.type === AST_NODE_TYPES.RestElement ||
    param.type === AST_NODE_TYPES.ObjectPattern ||
    param.type === AST_NODE_TYPES.ArrayPattern
  ) {
    typeNode = param.typeAnnotation?.typeAnnotation;
  } else {
    typeNode = param as TSESTree.Node;
  }
  if (typeNode) {
    walkInputPositions(typeNode, paramName, cb);
  }
}

function walkPropertyTypeForInput(
  node: TSESTree.Node,
  paramName: string,
  cb: (ref: TSESTree.TSTypeReference) => void,
): void {
  if (node.type === AST_NODE_TYPES.TSFunctionType) {
    for (const p of node.params) {
      walkParamAnnotation(p, paramName, cb);
    }
    if (node.returnType?.typeAnnotation) {
      walkPropertyTypeForInput(
        node.returnType.typeAnnotation,
        paramName,
        cb,
      );
    }
  } else if (node.type === AST_NODE_TYPES.TSConstructorType) {
    for (const p of node.params) {
      walkParamAnnotation(p, paramName, cb);
    }
  } else if (node.type === AST_NODE_TYPES.TSCallSignatureDeclaration) {
    for (const p of node.params) {
      walkParamAnnotation(p, paramName, cb);
    }
    if (node.returnType?.typeAnnotation) {
      walkPropertyTypeForInput(
        node.returnType.typeAnnotation,
        paramName,
        cb,
      );
    }
  } else if (node.type === AST_NODE_TYPES.TSConstructSignatureDeclaration) {
    for (const p of node.params) {
      walkParamAnnotation(p, paramName, cb);
    }
    if (node.returnType?.typeAnnotation) {
      walkPropertyTypeForInput(
        node.returnType.typeAnnotation,
        paramName,
        cb,
      );
    }
  } else if (node.type === AST_NODE_TYPES.TSTypeLiteral) {
    for (const member of node.members) {
      walkMemberForInput(member, paramName, cb);
    }
  }
}

function walkMemberForInput(
  member: TSESTree.Node,
  paramName: string,
  cb: (ref: TSESTree.TSTypeReference) => void,
): void {
  if (member.type === AST_NODE_TYPES.TSMethodSignature) {
    const m = member as TSESTree.TSMethodSignature;
    for (const p of m.params) {
      walkParamAnnotation(p, paramName, cb);
    }
  } else if (member.type === AST_NODE_TYPES.TSPropertySignature) {
    const p = member as TSESTree.TSPropertySignature;
    if (p.typeAnnotation?.typeAnnotation) {
      walkPropertyTypeForInput(
        p.typeAnnotation.typeAnnotation,
        paramName,
        cb,
      );
    }
  } else if (member.type === AST_NODE_TYPES.TSCallSignatureDeclaration) {
    const cs = member as TSESTree.TSCallSignatureDeclaration;
    for (const p of cs.params) {
      walkParamAnnotation(p, paramName, cb);
    }
    if (cs.returnType?.typeAnnotation) {
      walkPropertyTypeForInput(
        cs.returnType.typeAnnotation,
        paramName,
        cb,
      );
    }
  } else if (member.type === AST_NODE_TYPES.TSConstructSignatureDeclaration) {
    const cs = member as TSESTree.TSConstructSignatureDeclaration;
    for (const p of cs.params) {
      walkParamAnnotation(p, paramName, cb);
    }
    if (cs.returnType?.typeAnnotation) {
      walkPropertyTypeForInput(
        cs.returnType.typeAnnotation,
        paramName,
        cb,
      );
    }
  }
}

function findInputPositionRefs(
  body: TSESTree.TSInterfaceBody | TSESTree.TSTypeLiteral,
  paramName: string,
): TSESTree.TSTypeReference[] {
  const refs: TSESTree.TSTypeReference[] = [];
  const members =
    body.type === AST_NODE_TYPES.TSInterfaceBody ? body.body : body.members;
  for (const member of members) {
    walkMemberForInput(member, paramName, (ref) => refs.push(ref));
  }
  return refs;
}

function delegateOutputChild(
  node: TSESTree.Node,
  child: TSESTree.Node,
  paramName: string,
  cb: (ref: TSESTree.TSTypeReference) => void,
): void {
  walkOutputPositions(child, paramName, cb);
}

function walkOutputPositions(
  node: TSESTree.Node,
  paramName: string,
  cb: (ref: TSESTree.TSTypeReference) => void,
): void {
  reportIfMatch(node, paramName, cb);

  switch (node.type) {
    case AST_NODE_TYPES.TSTypeReference:
      walkOutputTypeReferenceArgs(node, paramName, cb);
      break;
    case AST_NODE_TYPES.TSArrayType:
      delegateOutputChild(node, node.elementType, paramName, cb);
      break;
    case AST_NODE_TYPES.TSTupleType:
      walkOutputEach(node.elementTypes, paramName, cb);
      break;
    case AST_NODE_TYPES.TSUnionType:
    case AST_NODE_TYPES.TSIntersectionType:
      walkOutputEach(node.types, paramName, cb);
      break;
    case AST_NODE_TYPES.TSRestType:
      delegateOutputChild(node, node.typeAnnotation, paramName, cb);
      break;
    case AST_NODE_TYPES.TSOptionalType:
      delegateOutputChild(node, node.typeAnnotation, paramName, cb);
      break;
    case AST_NODE_TYPES.TSParenthesizedType:
      delegateOutputChild(node, node.typeAnnotation, paramName, cb);
      break;
    case AST_NODE_TYPES.TSConditionalType:
      walkOutputConditionalBranches(node, paramName, cb);
      break;
    case AST_NODE_TYPES.TSMappedType:
      walkOutputIfPresent(node.typeAnnotation, paramName, cb);
      break;
    case AST_NODE_TYPES.TSIndexedAccessType:
      delegateOutputChild(node, node.objectType, paramName, cb);
      break;
    case AST_NODE_TYPES.TSTypeOperator:
      walkOutputIfPresent(node.typeAnnotation, paramName, cb);
      break;
    case AST_NODE_TYPES.TSFunctionType:
      walkOutputFunctionReturn(node, paramName, cb);
      break;
    case AST_NODE_TYPES.TSConstructorType:
      walkOutputFunctionReturn(node, paramName, cb);
      break;
    case AST_NODE_TYPES.TSTypeLiteral:
      walkOutputMembers(node.members, paramName, cb);
      break;
  }
}

function walkOutputTypeReferenceArgs(
  node: TSESTree.TSTypeReference,
  paramName: string,
  cb: (ref: TSESTree.TSTypeReference) => void,
): void {
  if (node.typeArguments) {
    for (const arg of node.typeArguments.params) {
      walkOutputPositions(arg, paramName, cb);
    }
  }
}

function walkOutputEach(
  children: TSESTree.TypeNode[],
  paramName: string,
  cb: (ref: TSESTree.TSTypeReference) => void,
): void {
  for (const child of children) {
    walkOutputPositions(child, paramName, cb);
  }
}

function walkOutputConditionalBranches(
  node: TSESTree.TSConditionalType,
  paramName: string,
  cb: (ref: TSESTree.TSTypeReference) => void,
): void {
  if (node.trueType) {
    walkOutputPositions(node.trueType, paramName, cb);
  }
  if (node.falseType) {
    walkOutputPositions(node.falseType, paramName, cb);
  }
}

function walkOutputIfPresent(
  typeAnnotation: TSESTree.TypeNode | undefined,
  paramName: string,
  cb: (ref: TSESTree.TSTypeReference) => void,
): void {
  if (typeAnnotation) {
    walkOutputPositions(typeAnnotation, paramName, cb);
  }
}

function walkOutputFunctionReturn(
  node: TSESTree.TSFunctionType | TSESTree.TSConstructorType,
  paramName: string,
  cb: (ref: TSESTree.TSTypeReference) => void,
): void {
  if (node.returnType?.typeAnnotation) {
    walkOutputPositions(node.returnType.typeAnnotation, paramName, cb);
  }
}

function walkOutputMembers(
  members: TSESTree.TypeElement[],
  paramName: string,
  cb: (ref: TSESTree.TSTypeReference) => void,
): void {
  for (const member of members) {
    walkMemberForOutput(member, paramName, cb);
  }
}

function walkMemberForOutput(
  member: TSESTree.Node,
  paramName: string,
  cb: (ref: TSESTree.TSTypeReference) => void,
): void {
  if (member.type === AST_NODE_TYPES.TSMethodSignature) {
    const m = member as TSESTree.TSMethodSignature;
    if (m.returnType?.typeAnnotation) {
      walkOutputPositions(m.returnType.typeAnnotation, paramName, cb);
    }
  } else if (member.type === AST_NODE_TYPES.TSPropertySignature) {
    const p = member as TSESTree.TSPropertySignature;
    if (p.typeAnnotation?.typeAnnotation) {
      walkOutputPositions(p.typeAnnotation.typeAnnotation, paramName, cb);
    }
  } else if (member.type === AST_NODE_TYPES.TSIndexSignature) {
    if (member.typeAnnotation?.typeAnnotation) {
      walkOutputPositions(
        member.typeAnnotation.typeAnnotation,
        paramName,
        cb,
      );
    }
  } else if (member.type === AST_NODE_TYPES.TSCallSignatureDeclaration) {
    const cs = member as TSESTree.TSCallSignatureDeclaration;
    if (cs.returnType?.typeAnnotation) {
      walkOutputPositions(
        cs.returnType.typeAnnotation,
        paramName,
        cb,
      );
    }
  } else if (member.type === AST_NODE_TYPES.TSConstructSignatureDeclaration) {
    const cs = member as TSESTree.TSConstructSignatureDeclaration;
    if (cs.returnType?.typeAnnotation) {
      walkOutputPositions(
        cs.returnType.typeAnnotation,
        paramName,
        cb,
      );
    }
  }
}

function findOutputPositionRefs(
  body: TSESTree.TSInterfaceBody | TSESTree.TSTypeLiteral,
  paramName: string,
): TSESTree.TSTypeReference[] {
  const refs: TSESTree.TSTypeReference[] = [];
  const members =
    body.type === AST_NODE_TYPES.TSInterfaceBody ? body.body : body.members;
  for (const member of members) {
    walkMemberForOutput(member, paramName, (ref) => refs.push(ref));
  }
  return refs;
}

function checkVariance(
  context: Parameters<NonNullable<Parameters<typeof createRule>[0]["create"]>>[0],
  typeParams: TSESTree.TSTypeParameter[],
  body: TSESTree.TSInterfaceBody | TSESTree.TSTypeLiteral,
): void {
  for (const tp of typeParams) {
    const name = tp.name.name;
    const onlyOut = tp.out && !tp.in;
    const onlyIn = tp.in && !tp.out;

    if (onlyOut) {
      const refs = findInputPositionRefs(body, name);
      for (const ref of refs) {
        context.report({
          node: ref,
          messageId: "outUsedAsInput",
          data: { paramName: name },
        });
      }
    }

    if (onlyIn) {
      const refs = findOutputPositionRefs(body, name);
      for (const ref of refs) {
        context.report({
          node: ref,
          messageId: "inUsedAsOutput",
          data: { paramName: name },
        });
      }
    }
  }
}

export default createRule({
  name: "no-mismatched-variance-marker",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow variance markers on type parameters that do not match their actual usage",
    },
    messages: {
      outUsedAsInput:
        "Type parameter '{{paramName}}' is marked 'out' but is used as an input parameter. Consider using 'in out' or removing 'out'. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T08-variance-subtyping.md",
      inUsedAsOutput:
        "Type parameter '{{paramName}}' is marked 'in' but is used as a return type. Consider using 'in out' or removing 'in'. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T08-variance-subtyping.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"outUsedAsInput" | "inUsedAsOutput", []>) {
    return {
      TSInterfaceDeclaration(node) {
        const decl = node;
        if (
          decl.typeParameters &&
          decl.typeParameters.params.length > 0 &&
          decl.body
        ) {
          checkVariance(context, decl.typeParameters.params, decl.body);
        }
      },

      TSTypeAliasDeclaration(decl) {
        if (
          decl.typeParameters &&
          decl.typeParameters.params.length > 0 &&
          decl.typeAnnotation.type === AST_NODE_TYPES.TSTypeLiteral
        ) {
          checkVariance(
            context,
            decl.typeParameters.params,
            decl.typeAnnotation,
          );
        }
      },
    };
  },
});
