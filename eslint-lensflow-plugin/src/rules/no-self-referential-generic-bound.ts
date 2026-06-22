import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

function checkTypeReference(
  node: TSESTree.TSTypeReference,
  paramName: string,
): boolean {
  if (
    node.typeName.type === "Identifier" &&
    node.typeName.name === paramName
  ) {
    return true;
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

function containsTypeParamReference(
  node: TSESTree.Node,
  paramName: string,
): boolean {
  if (node.type === "TSTypeParameter") {
    return node.name.name === paramName;
  }
  if (node.type === "TSTypeReference") {
    return checkTypeReference(node, paramName);
  }
  if (node.type === "TSUnionType" || node.type === "TSIntersectionType") {
    return node.types.some((t) => containsTypeParamReference(t, paramName));
  }
  if (node.type === "TSArrayType") {
    return containsTypeParamReference(node.elementType, paramName);
  }
  if (node.type === "TSTupleType") {
    return node.elementTypes.some((e) => containsTypeParamReference(e, paramName));
  }
  if (node.type === "TSFunctionType" || node.type === "TSConstructorType") {
    return checkFunctionOrConstructorType(node, paramName);
  }
  if (node.type === "TSTypeQuery") {
    return checkTypeQuery(node, paramName);
  }
  if (node.type === "TSTypeLiteral") {
    return checkTypeLiteral(node, paramName);
  }
  if (node.type === "TSConditionalType") {
    return checkConditionalType(node, paramName);
  }
  if (node.type === "TSMappedType") {
    return checkMappedType(node, paramName);
  }
  if (node.type === "TSIndexedAccessType") {
    return checkIndexedAccessType(node, paramName);
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
        "Type parameter '{{name}}' references itself in its constraint '{{constraint}}'. This creates a self-referential F-bound that confuses type inference. Separate the element type from the container type. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T04-generics-bounds.md",
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
              : `${node.constraint.type}`;

          context.report({
            node,
            messageId: "selfReferentialBound",
            data: {
              name: paramName,
              constraint: constraintText,
            },
          });
        }
      },
    };
  },
});
