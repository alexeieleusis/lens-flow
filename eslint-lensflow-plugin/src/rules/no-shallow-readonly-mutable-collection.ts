import { AST_NODE_TYPES, TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

function isMutableCollectionType(node: TSESTree.TypeNode): boolean {
  if (node.type === AST_NODE_TYPES.TSArrayType) {
    const arrNode = node as TSESTree.TSArrayType;
    if (
      arrNode.elementType?.type === AST_NODE_TYPES.TSTypeOperator &&
      (arrNode.elementType as TSESTree.TSTypeOperator).operator === "readonly"
    ) {
      return false;
    }
    return true;
  }

  if (node.type === AST_NODE_TYPES.TSTypeReference) {
    const refNode = node as TSESTree.TSTypeReference;
    if (refNode.typeName.type === AST_NODE_TYPES.Identifier) {
      const name = (refNode.typeName as TSESTree.Identifier).name;
      return name === "Map" || name === "Set" || name === "Array";
    }
    return false;
  }

  if (node.type === AST_NODE_TYPES.TSIntersectionType) {
    const interNode = node as TSESTree.TSIntersectionType;
    return interNode.types.some((t) => isMutableCollectionType(t));
  }

  if (node.type === AST_NODE_TYPES.TSUnionType) {
    const unionNode = node as TSESTree.TSUnionType;
    return unionNode.types.some((t) => isMutableCollectionType(t));
  }

  return false;
}

function isArrayType(node: TSESTree.TypeNode): boolean {
  return node.type === AST_NODE_TYPES.TSArrayType;
}

function isTypeReference(node: TSESTree.TypeNode): boolean {
  return node.type === AST_NODE_TYPES.TSTypeReference;
}

function getPropertyName(key: TSESTree.PropertyName): string {
  if (key.type === AST_NODE_TYPES.Identifier) {
    return (key as TSESTree.Identifier).name;
  }
  if (key.type === AST_NODE_TYPES.Literal) {
    return String((key as TSESTree.Literal).value);
  }
  return "unknown";
}

function getArrayElementName(elementType: TSESTree.TypeNode): string {
  if (elementType.type === AST_NODE_TYPES.TSTypeReference) {
    const refNode = elementType as TSESTree.TSTypeReference;
    if (refNode.typeName.type === AST_NODE_TYPES.Identifier) {
      return refNode.typeName.name;
    }
  }
  return elementType.type;
}

export default createRule({
  name: "no-shallow-readonly-mutable-collection",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow readonly modifier on properties holding mutable collection types (array, Map, Set) which only prevents reassignment but not in-place mutation.",
    },
    messages: {
      mutableArray:
        "Property {{name}} is marked readonly but holds a mutable array type. Use readonly {{element}}[] instead of {{element}}[]. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T21-encapsulation.md",
      mutableMapSet:
        "Property {{name}} is marked readonly but holds a mutable {{collection}} type. Use Readonly{{collection}} instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T21-encapsulation.md",
      mutableIntersection:
        "Property {{name}} is marked readonly but its type includes a mutable collection. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T21-encapsulation.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"mutableMapSet" | "mutableArray" | "mutableIntersection", []>) {
    function checkProperty(
      node: TSESTree.PropertyDefinition | TSESTree.TSPropertySignature,
    ): void {
      if (!node.readonly) return;
      const typeAnnotation = node.typeAnnotation?.typeAnnotation;
      if (!typeAnnotation) return;
      if (!isMutableCollectionType(typeAnnotation)) return;

      const propName = getPropertyName(node.key);

      reportMutableCollection(node, propName, typeAnnotation);
    }

    function reportMutableCollection(
      reportNode: TSESTree.PropertyDefinition | TSESTree.TSPropertySignature | TSESTree.TSParameterProperty,
      propName: string,
      typeAnnotation: TSESTree.TypeNode,
    ): void {
      if (isTypeReference(typeAnnotation)) {
        const refNode = typeAnnotation as TSESTree.TSTypeReference;
        let typeName: string | undefined;
        if (refNode.typeName.type === AST_NODE_TYPES.Identifier) {
          typeName = refNode.typeName.name;
        }
        if (typeName === "Map" || typeName === "Set") {
          context.report({
            node: reportNode,
            messageId: "mutableMapSet",
            data: { name: propName, collection: typeName },
          });
        }
        if (typeName === "Array") {
          const elementName = getArrayElementName(
            refNode.typeArguments?.params?.[0] ?? {} as TSESTree.TypeNode,
          );
          context.report({
            node: reportNode,
            messageId: "mutableArray",
            data: { name: propName, element: elementName },
          });
        }
        return;
      }

      if (isArrayType(typeAnnotation)) {
        const elementName = getArrayElementName(
          (typeAnnotation as TSESTree.TSArrayType).elementType,
        );
        context.report({
          node: reportNode,
          messageId: "mutableArray",
          data: { name: propName, element: elementName },
        });
        return;
      }

      context.report({
        node: reportNode,
        messageId: "mutableIntersection",
        data: { name: propName },
      });
    }

    function checkParameterProperty(
      node: TSESTree.TSParameterProperty,
    ): void {
      if (!node.readonly) return;
      const parameter = node.parameter;
      if (parameter.type !== AST_NODE_TYPES.Identifier) return;
      const typedParam = parameter as TSESTree.Identifier & { typeAnnotation?: TSESTree.TSTypeAnnotation };
      const typeAnnotation = typedParam.typeAnnotation?.typeAnnotation;
      if (!typeAnnotation) return;
      if (!isMutableCollectionType(typeAnnotation)) return;

      const propName = (typedParam as TSESTree.Identifier).name;
      reportMutableCollection(node, propName, typeAnnotation);
    }

    return {
      ClassBody(node) {
        for (const member of node.body) {
          if (
            member.type === AST_NODE_TYPES.PropertyDefinition &&
            member.readonly &&
            member.typeAnnotation
          ) {
            checkProperty(member);
          }
        }
      },

      MethodDefinition(node) {
        if (
          node.key.type !== AST_NODE_TYPES.Identifier ||
          node.key.name !== "constructor"
        ) return;

        for (const param of node.value.params) {
          if (param.type === AST_NODE_TYPES.TSParameterProperty) {
            checkParameterProperty(param);
          }
        }
      },

      TSInterfaceBody(node) {
        for (const member of node.body) {
          if (
            member.type === AST_NODE_TYPES.TSPropertySignature &&
            member.readonly &&
            member.typeAnnotation
          ) {
            checkProperty(member);
          }
        }
      },

      TSTypeLiteral(node) {
        for (const member of node.members) {
          if (
            member.type === AST_NODE_TYPES.TSPropertySignature &&
            member.readonly &&
            member.typeAnnotation
          ) {
            checkProperty(member);
          }
        }
      },
    };
  },
});