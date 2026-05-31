import { AST_NODE_TYPES, TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

type MutableCollectionType =
  | "TSArrayType"
  | "TSTypeReference"
  | "TSIntersectionType";

function isMutableCollectionType(node: unknown): node is { type: MutableCollectionType } {
  if (!node || typeof node !== "object" || !("type" in node)) return false;

  const typedNode = node as { type: string };

  if (typedNode.type === AST_NODE_TYPES.TSArrayType) {
    const arrNode = typedNode as { type: string; elementType?: unknown };
    if (
      arrNode.elementType &&
      typeof arrNode.elementType === "object" &&
      "type" in arrNode.elementType &&
      (arrNode.elementType as { type: string }).type ===
        AST_NODE_TYPES.TSTypeOperator &&
      (arrNode.elementType as { type: string; operator?: string }).operator ===
        "readonly"
    ) {
      return false;
    }
    return true;
  }

  if (typedNode.type === AST_NODE_TYPES.TSTypeReference) {
    const refNode = typedNode as { type: string; typeName?: unknown };
    if (
      refNode.typeName &&
      typeof refNode.typeName === "object" &&
      "type" in refNode.typeName &&
      (refNode.typeName as { type: string }).type === AST_NODE_TYPES.Identifier
    ) {
      const name = (refNode.typeName as { name?: string }).name;
      return name === "Map" || name === "Set";
    }
    return false;
  }

  if (typedNode.type === AST_NODE_TYPES.TSIntersectionType) {
    const interNode = typedNode as { type: string; types?: unknown[] };
    return interNode.types?.some((t) => isMutableCollectionType(t)) ?? false;
  }

  return false;
}

function isArrayType(node: unknown): boolean {
  return (
    node !== null &&
    typeof node === "object" &&
    "type" in node &&
    (node as { type: string }).type === AST_NODE_TYPES.TSArrayType
  );
}

function isTypeReference(node: unknown): boolean {
  return (
    node !== null &&
    typeof node === "object" &&
    "type" in node &&
    (node as { type: string }).type === AST_NODE_TYPES.TSTypeReference
  );
}

function getPropertyName(key: unknown): string {
  if (key && typeof key === "object" && "name" in key) {
    return (key as { name?: string }).name ?? "unknown";
  }
  return "unknown";
}

function getArrayElementName(elementType: unknown): string {
  if (
    elementType &&
    typeof elementType === "object" &&
    "type" in elementType &&
    (elementType as { type: string }).type === AST_NODE_TYPES.TSTypeReference
  ) {
    return (
      (elementType as { typeName?: { name?: string } }).typeName?.name ??
      "unknown"
    );
  }
  if (
    elementType &&
    typeof elementType === "object" &&
    "type" in elementType
  ) {
    return (elementType as { type: string }).type;
  }
  return "unknown";
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
        "Property {{name}} is marked readonly but holds a mutable array type. Use readonly {{element}}[] instead of {{element}}[]. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T21-encapsulation.md",
      mutableMapSet:
        "Property {{name}} is marked readonly but holds a mutable {{collection}} type. Use Readonly{{collection}} instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T21-encapsulation.md",
      mutableIntersection:
        "Property {{name}} is marked readonly but its type includes a mutable collection. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T21-encapsulation.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"mutableMapSet" | "mutableArray" | "mutableIntersection", []>) {
    function checkProperty(
      node:
        | {
            readonly?: boolean;
            typeAnnotation?: { typeAnnotation?: unknown };
            key?: { name?: string };
          }
        | {
            readonly?: boolean;
            typeAnnotation?: { typeAnnotation?: unknown };
            key?: unknown;
          },
    ): void {
      if (!node.readonly) return;
      const typeAnnotation = node.typeAnnotation?.typeAnnotation;
      if (!typeAnnotation) return;
      if (!isMutableCollectionType(typeAnnotation)) return;

      const propName = getPropertyName(node.key);

      if (isTypeReference(typeAnnotation)) {
        const refNode = typeAnnotation as { typeName?: { name?: string } };
        const typeName = refNode.typeName?.name;
        if (typeName === "Map" || typeName === "Set") {
          context.report({
            node: node as unknown as TSESTree.Node,
            messageId: "mutableMapSet",
            data: { name: propName, collection: typeName },
          });
        }
        return;
      }

      if (isArrayType(typeAnnotation)) {
        const arrNode = typeAnnotation as { elementType?: unknown };
        const elementName = getArrayElementName(arrNode.elementType);
        context.report({
          node: node as unknown as TSESTree.Node,
          messageId: "mutableArray",
          data: { name: propName, element: elementName },
        });
        return;
      }

      context.report({
        node: node as unknown as TSESTree.Node,
        messageId: "mutableIntersection",
        data: { name: propName },
      });
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
