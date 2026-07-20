import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

const URL = knowledgeUrl("catalog/T18-conversions-coercions.md");

function isWidenedPrimitiveType(typeNode: TSESTree.TypeNode): boolean {
  if (
    typeNode.type === "TSNumberKeyword" ||
    typeNode.type === "TSStringKeyword" ||
    typeNode.type === "TSBooleanKeyword"
  ) {
    return true;
  }
  if (typeNode.type === "TSTypeReference") {
    return true;
  }
  return false;
}

function getPropertyName(key: TSESTree.Property["key"]): string | null {
  if (key.type === "Identifier") return key.name;
  if (key.type === "Literal" && typeof key.value === "string") return key.value;
  if (key.type === "Literal" && typeof key.value === "number") return String(key.value);
  if (key.type === "Literal" && key.value === null) return null;
  return null;
}

function isAsConstSafeReplacement(
  objectExpr: TSESTree.ObjectExpression,
  typeLiteral: TSESTree.TSTypeLiteral
): boolean {
  const typeMembers = typeLiteral.members.filter(
    (m) => m.type === "TSPropertySignature"
  );

  const ownProperties = objectExpr.properties.filter(
    (p) => p.type === "Property"
  );

  if (typeMembers.length !== ownProperties.length) {
    return false;
  }

  const typeKeys = new Set<string>();
  for (const member of typeMembers) {
    if (member.type !== "TSPropertySignature" || !member.key) continue;
    const key = getPropertyName(member.key);
    if (key !== null) typeKeys.add(key);
  }

  for (const prop of ownProperties) {
    if (prop.computed) continue;
    const key = getPropertyName(prop.key);
    if (key !== null && !typeKeys.has(key)) {
      return false;
    }
  }

  return true;
}

export default createRule({
  name: "prefer-as-const",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer `as const` over explicit object type assertion on object literals",
    },
    messages: {
      preferAsConst:
        "Prefer `as const` instead of explicit object type assertion on an object literal. This preserves literal types without manual annotation. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"preferAsConst", []>) {
    return {
      TSAsExpression(node) {
        if (
          node.expression.type === "ObjectExpression" &&
          node.typeAnnotation.type === "TSTypeLiteral" &&
          node.typeAnnotation.members.length > 0 &&
          node.typeAnnotation.members.every(
            (m) => m.type === "TSPropertySignature" && m.readonly
          ) &&
          isAsConstSafeReplacement(node.expression, node.typeAnnotation)
        ) {
          context.report({
            node,
            messageId: "preferAsConst",
            data: { url: URL },
          });
        }
      },
    };
  },
});
