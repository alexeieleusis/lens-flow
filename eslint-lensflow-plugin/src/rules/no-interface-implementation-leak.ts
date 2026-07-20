import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESLint } from "@typescript-eslint/utils";

const URL = knowledgeUrl("catalog/T21-encapsulation.md");

const INTERNAL_COLLECTIONS = new Set(["Map", "Set", "WeakMap", "WeakSet"]);

function getTypeName(node: any): string | null {
  if (node.typeName.type === "Identifier") {
    return node.typeName.name;
  }
  if (node.typeName.type === "TSQualifiedName") {
    return node.typeName.right.name;
  }
  return null;
}

function getPropertyNameFromKey(key: any): string | null {
  if (key.type === "Literal") {
    return String(key.value);
  }
  return null;
}

function analyzeInterfaceMembers(node: any) {
  const internalNameProps: string[] = [];
  const exposedCollectionProps: string[] = [];

  for (const member of node.body) {
    if (member.type !== "TSPropertySignature") continue;

    const propName =
      member.key.type === "Identifier"
        ? member.key.name
        : getPropertyNameFromKey(member.key);

    if (propName && /^(internal|_)/.test(propName)) {
      internalNameProps.push(propName);
    }

    const typeAnn = member.typeAnnotation?.typeAnnotation;
    if (isExposedCollection(typeAnn)) {
      exposedCollectionProps.push(propName ?? "?");
    }
  }

  return { internalNameProps, exposedCollectionProps };
}

function isExposedCollection(typeAnn: any) {
  if (!typeAnn) return false;

  // Unwrap union, intersection, and parenthesized types recursively
  if (typeAnn.type === "TSUnionType" || typeAnn.type === "TSIntersectionType") {
    return typeAnn.types.some(isExposedCollection);
  }
  if (typeAnn.type === "TSParenthesizedType") {
    return isExposedCollection(typeAnn.typeAnnotation);
  }

  // Check TSTypeReference for Array and internal collections
  if (typeAnn.type === "TSTypeReference") {
    const name = getTypeName(typeAnn);
    if (name && (INTERNAL_COLLECTIONS.has(name) || name === "Array")) {
      return true;
    }
  }

  // Check TSArrayType (e.g., string[])
  if (typeAnn.type === "TSArrayType") {
    return true;
  }

  return false;
}

function reportInterfaceIssues(
  context: any,
  node: any,
  internalNameProps: string[],
  exposedCollectionProps: string[],
) {
  const interfaceDecl =
    node.parent?.type === "TSInterfaceDeclaration"
      ? node.parent
      : node.parent?.parent;

  if (internalNameProps.length > 0) {
    context.report({
      node: interfaceDecl ?? node,
      messageId: "internalName",
      data: { names: internalNameProps.join(", "), url: URL },
    });
  }

  if (exposedCollectionProps.length > 0) {
    context.report({
      node: interfaceDecl ?? node,
      messageId: "exposedCollection",
      data: { names: exposedCollectionProps.join(", "), url: URL },
    });
  }
}

export default createRule({
  name: "no-interface-implementation-leak",
  meta: {
    fixable: undefined,
    type: "problem",
    docs: {
      description:
        "Disallow interfaces that expose internal data structures or implementation-detail property names",
    },
    messages: {
      internalName:
        "Interface exposes implementation-detail property name(s): {{names}}. Use abstract method names instead. See: {{url}}",
      exposedCollection:
        "Interface exposes internal collection type(s) on property/properties: {{names}}. Expose abstract accessors instead. See: {{url}}",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"internalName" | "exposedCollection", []>) {
    return {
      TSInterfaceBody(node) {
        const { internalNameProps, exposedCollectionProps } =
          analyzeInterfaceMembers(node);

        reportInterfaceIssues(
          context,
          node,
          internalNameProps,
          exposedCollectionProps,
        );
      },
    };
  },
});
