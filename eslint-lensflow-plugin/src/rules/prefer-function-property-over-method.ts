import type { TSESTree } from "@typescript-eslint/utils";
import { TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

function findInterfaceTypeParams(
  node: TSESTree.TSMethodSignature,
): Set<string> | null {
  let current: TSESTree.Node | null | undefined = node.parent;
  while (current) {
    if (
      current.type === "TSInterfaceDeclaration" &&
      current.typeParameters &&
      current.typeParameters.params.length > 0
    ) {
      return new Set(
        current.typeParameters.params.map((tp) => tp.name.name),
      );
    }
    current = current.parent;
  }
  return null;
}

function referencesTypeParam(
  param: TSESTree.TSParameterProperty | TSESTree.Parameter,
  typeParamNames: Set<string>,
): boolean {
  const actualParam =
    param.type === "TSParameterProperty" ? param.parameter : param;
  if (!actualParam.typeAnnotation?.typeAnnotation) return false;

  const typeAnnotation = actualParam.typeAnnotation.typeAnnotation;

  function qualifiedNameHasTypeParam(
    qn: TSESTree.TSQualifiedName
  ): boolean {
    if (typeParamNames.has(qn.right.name)) return true;
    const left = qn.left;
    if (left.type === "Identifier") {
      return typeParamNames.has(left.name);
    }
    if (left.type === "TSQualifiedName") {
      return qualifiedNameHasTypeParam(left);
    }
    return false;
  }

  function walkTypeReference(
    node: TSESTree.TSTypeReference
  ): boolean {
    if (
      node.typeName.type === "Identifier" &&
      typeParamNames.has(node.typeName.name)
    ) {
      return true;
    }
    if (
      node.typeName.type === "TSQualifiedName" &&
      qualifiedNameHasTypeParam(node.typeName)
    ) {
      return true;
    }
    if (node.typeArguments) {
      return node.typeArguments.params.some(walk);
    }
    return false;
  }

  function walk(node: TSESTree.TypeNode): boolean {
    switch (node.type) {
      case "TSTypeReference":
        return walkTypeReference(node);
      case "TSUnionType":
        return node.types.some(walk);
      case "TSIntersectionType":
        return node.types.some(walk);
      case "TSArrayType":
        return walk(node.elementType);
      case "TSTupleType":
        return node.elementTypes.some((el) => walk(el));
      case "TSFunctionType":
      case "TSConstructorType":
        return (
          node.params.some((p) => referencesTypeParam(p, typeParamNames)) ||
          (node.returnType ? walk(node.returnType.typeAnnotation) : false)
        );
      case "TSConditionalType":
        return walk(node.checkType) || walk(node.extendsType) || walk(node.trueType) || walk(node.falseType);
      case "TSMappedType":
        return node.typeAnnotation ? walk(node.typeAnnotation) : false;
      case "TSIndexedAccessType":
        return walk(node.objectType) || walk(node.indexType);
      case "TSParenthesizedType":
        return walk(node.typeAnnotation);
      case "TSTypeQuery":
        return false;
      default:
        return false;
    }
  }

  return walk(typeAnnotation);
}

export default createRule({
  name: "prefer-function-property-over-method",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer function property types over method signatures in generic interfaces to enforce contravariance",
    },
    messages: {
      preferFunctionProperty:
        "Method '{{name}}' references generic type parameter(s) in a generic interface. Use a function property type instead to enforce contravariant checking. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T22-callable-typing.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"preferFunctionProperty", []>) {
    return {
      TSMethodSignature(node) {
        const typeParamNames = findInterfaceTypeParams(node);
        if (!typeParamNames) return;

        let methodName: string;
        if (node.key.type === "Identifier") {
          methodName = node.key.name;
        } else if (node.key.type === "Literal" && typeof node.key.value === "string") {
          methodName = node.key.value;
        } else {
          methodName = "<unknown>";
        }

        const hasParamRef = node.params.some((p) =>
          referencesTypeParam(p, typeParamNames),
        );

        if (hasParamRef) {
          context.report({
            node,
            messageId: "preferFunctionProperty",
            data: { name: methodName },
          });
        }
      },
    };
  },
});
