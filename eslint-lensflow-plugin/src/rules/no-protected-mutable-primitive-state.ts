import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

const URL = knowledgeUrl("catalog/T21-encapsulation.md");

const PRIMITIVE_KEYWORDS = new Set([
  "TSNumberKeyword",
  "TSBooleanKeyword",
  "TSStringKeyword",
]);

function isPrimitiveUnion(node: TSESTree.TypeNode): node is TSESTree.TSUnionType {
  if (node.type !== "TSUnionType") return false;
  return node.types.every((t) => PRIMITIVE_KEYWORDS.has(t.type));
}

function isProtectedMutableWithInit(
  member: TSESTree.ClassElement
): member is TSESTree.PropertyDefinition & {
  accessibility: "protected";
  value: TSESTree.Expression;
} {
  if (member.type !== "PropertyDefinition") return false;
  if (member.accessibility !== "protected") return false;
  if (member.static) return false;
  if (member.readonly) return false;
  if (!member.value) return false;
  return true;
}

function hasPrimitiveType(node: TSESTree.TypeNode): boolean {
  return PRIMITIVE_KEYWORDS.has(node.type) || isPrimitiveUnion(node);
}

function getPropertyName(key: TSESTree.Expression | TSESTree.PrivateIdentifier): string {
  if (key.type === "Identifier") return key.name;
  if (key.type === "Literal") return String(key.value);
  return "unknown";
}

export default createRule({
  name: "no-protected-mutable-primitive-state",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow protected mutable primitive properties that allow subclasses to bypass validation",
    },
    messages: {
      protectedMutablePrimitive:
        "Protected mutable primitive '{{name}}' allows subclasses to corrupt state without validation. Use a private field (#name) with a protected setter that validates input. See: {{url}}",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"protectedMutablePrimitive", []>) {
    return {
      ClassBody(node) {
        for (const member of node.body) {
          if (!isProtectedMutableWithInit(member)) continue;

          const typeAnn = member.typeAnnotation?.typeAnnotation;
          if (typeAnn && hasPrimitiveType(typeAnn)) {
            context.report({
              node: member,
              messageId: "protectedMutablePrimitive",
              data: { name: getPropertyName(member.key), url: URL },
            });
          }
        }
      },
    };
  },
});
