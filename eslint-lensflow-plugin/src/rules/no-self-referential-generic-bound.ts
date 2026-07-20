import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T04-generics-bounds.md");

function checkTypeReference(
  node: TSESTree.TSTypeReference,
  paramName: string,
): boolean {
  if (node.typeName.type === "Identifier") {
    if (node.typeName.name === paramName) return true;
  }
  if (node.typeName.type === "TSQualifiedName") {
    if (containsTypeParamReference(node.typeName, paramName)) {
      return true;
    }
  }
  if (node.typeArguments) {
    for (const arg of node.typeArguments.params) {
      if (containsTypeParamReference(arg, paramName)) {
        return true;
      }
    }
  }
  return false;
}

function checkFunctionOrConstructorType(
  node: TSESTree.TSFunctionType | TSESTree.TSConstructorType,
  paramName: string,
): boolean {
  if (node.typeParameters) {
    for (const tp of node.typeParameters.params) {
      if (containsTypeParamReference(tp, paramName)) {
        return true;
      }
    }
  }
  for (const param of node.params) {
    if (
      param.type === "Identifier" &&
      param.typeAnnotation?.typeAnnotation
    ) {
      if (containsTypeParamReference(param.typeAnnotation.typeAnnotation, paramName)) {
        return true;
      }
    }
  }
  if (node.returnType?.typeAnnotation) {
    return containsTypeParamReference(node.returnType.typeAnnotation, paramName);
  }
  return false;
}

function checkTypeQuery(
  node: TSESTree.TSTypeQuery,
  paramName: string,
): boolean {
  if (node.exprName.type === "Identifier") {
    return node.exprName.name === paramName;
  }
  if (node.exprName.type === "TSQualifiedName") {
    return containsTypeParamReference(node.exprName, paramName);
  }
  return false;
}

function checkTypeLiteralMember(
  member: TSESTree.TypeElement,
  paramName: string,
): boolean {
  if (member.type === "TSPropertySignature" && member.typeAnnotation) {
    return containsTypeParamReference(
      member.typeAnnotation.typeAnnotation,
      paramName
    );
  }
  if (member.type === "TSMethodSignature" && member.typeParameters) {
    return member.typeParameters.params.some((tp) =>
      containsTypeParamReference(tp, paramName)
    );
  }
  return false;
}

function checkTypeLiteral(
  node: TSESTree.TSTypeLiteral,
  paramName: string,
): boolean {
  return node.members.some((member) =>
    checkTypeLiteralMember(member, paramName)
  );
}

function checkConditionalType(
  node: TSESTree.TSConditionalType,
  paramName: string,
): boolean {
  return (
    containsTypeParamReference(node.checkType, paramName) ||
    containsTypeParamReference(node.extendsType, paramName) ||
    containsTypeParamReference(node.trueType, paramName) ||
    containsTypeParamReference(node.falseType, paramName)
  );
}

function checkMappedType(
  node: TSESTree.TSMappedType,
  paramName: string,
): boolean {
  return node.typeAnnotation
    ? containsTypeParamReference(node.typeAnnotation, paramName)
    : false;
}

function checkIndexedAccessType(
  node: TSESTree.TSIndexedAccessType,
  paramName: string,
): boolean {
  return (
    containsTypeParamReference(node.objectType, paramName) ||
    containsTypeParamReference(node.indexType, paramName)
  );
}

function checkTypeParameterNode(
  node: TSESTree.TSTypeParameter,
  paramName: string,
): boolean {
  if (node.name.name === paramName) return true;
  if (node.constraint && containsTypeParamReference(node.constraint, paramName)) {
    return true;
  }
  if (node.default && containsTypeParamReference(node.default, paramName)) {
    return true;
  }
  return false;
}

const typeHandlers: Record<
  string,
  (node: TSESTree.Node, paramName: string) => boolean
> = {
  TSTypeParameter: (node, paramName) =>
    checkTypeParameterNode(node as TSESTree.TSTypeParameter, paramName),
  TSTypeReference: (node, paramName) =>
    checkTypeReference(node as TSESTree.TSTypeReference, paramName),
  TSUnionType: (node, paramName) =>
    (node as TSESTree.TSUnionType).types.some((t) =>
      containsTypeParamReference(t, paramName)
    ),
  TSIntersectionType: (node, paramName) =>
    (node as TSESTree.TSIntersectionType).types.some((t) =>
      containsTypeParamReference(t, paramName)
    ),
  TSArrayType: (node, paramName) =>
    containsTypeParamReference(
      (node as TSESTree.TSArrayType).elementType,
      paramName
    ),
  TSTupleType: (node, paramName) =>
    (node as TSESTree.TSTupleType).elementTypes.some((e) =>
      containsTypeParamReference(e, paramName)
    ),
  TSFunctionType: (node, paramName) =>
    checkFunctionOrConstructorType(
      node as TSESTree.TSFunctionType,
      paramName
    ),
  TSConstructorType: (node, paramName) =>
    checkFunctionOrConstructorType(
      node as TSESTree.TSConstructorType,
      paramName
    ),
  TSTypeQuery: (node, paramName) =>
    checkTypeQuery(node as TSESTree.TSTypeQuery, paramName),
  TSTypeLiteral: (node, paramName) =>
    checkTypeLiteral(node as TSESTree.TSTypeLiteral, paramName),
  TSConditionalType: (node, paramName) =>
    checkConditionalType(node as TSESTree.TSConditionalType, paramName),
  TSMappedType: (node, paramName) =>
    checkMappedType(node as TSESTree.TSMappedType, paramName),
  TSIndexedAccessType: (node, paramName) =>
    checkIndexedAccessType(node as TSESTree.TSIndexedAccessType, paramName),
  TSQualifiedName: (node, paramName) => {
    const qualified = node as TSESTree.TSQualifiedName;
    return (
      containsTypeParamReference(qualified.left, paramName) ||
      containsTypeParamReference(qualified.right, paramName)
    );
  },
};

function containsTypeParamReference(
  node: TSESTree.Node,
  paramName: string,
): boolean {
  const handler = typeHandlers[node.type];
  if (handler) {
    return handler(node, paramName);
  }
  return false;
}

export default createRule({
  name: "no-self-referential-generic-bound",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow type parameters that appear in their own constraint (self-referential F-bound)",
    },
    messages: {
      selfReferentialBound:
        "Type parameter '{{name}}' references itself in its constraint '{{constraint}}'. This creates a self-referential F-bound that confuses type inference. Separate the element type from the container type. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"selfReferentialBound", []>) {
    return {
      TSTypeParameter(node) {
        if (!node.constraint) return;

        const paramName = node.name.name;

        if (containsTypeParamReference(node.constraint, paramName)) {
          const constraintText =
            node.constraint.type === "TSTypeReference" &&
            node.constraint.typeName.type === "Identifier"
              ? node.constraint.typeName.name
              : context.sourceCode.getText(node.constraint);

          context.report({
            node,
            messageId: "selfReferentialBound",
            data: {
              name: paramName,
              constraint: constraintText,
              url: URL,
            },
          });
        }
      },
    };
  },
});
