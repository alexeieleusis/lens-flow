import { createRule } from "../utils/rule-creator.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

const PRIMITIVE_KEYWORDS = new Set([
  "TSNumberKeyword",
  "TSBooleanKeyword",
  "TSStringKeyword",
]);

function isPrimitiveUnion(node: TSESTree.TypeNode): node is TSESTree.TSUnionType {
  if (node.type !== "TSUnionType") return false;
  return node.types.every((t) => PRIMITIVE_KEYWORDS.has(t.type));
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
        "Protected mutable primitive '{{name}}' allows subclasses to corrupt state without validation. Use a private field (#name) with a protected setter that validates input. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T21-encapsulation.md",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"protectedMutablePrimitive", []>) {
    return {
      ClassBody(node) {
        for (const member of node.body) {
          if (member.type !== "PropertyDefinition") continue;
          if (member.accessibility !== "protected") continue;
          if (member.static) continue;
          if (member.readonly) continue;

          if (!member.value) continue;

          const typeAnn = member.typeAnnotation?.typeAnnotation;
          if (
            typeAnn &&
            (PRIMITIVE_KEYWORDS.has(typeAnn.type) || isPrimitiveUnion(typeAnn))
          ) {
            let propName: string;
            if (member.key.type === "Identifier") {
              propName = member.key.name;
            } else if (member.key.type === "Literal") {
              propName = String(member.key.value);
            } else {
              propName = "unknown";
            }
            context.report({
              node: member,
              messageId: "protectedMutablePrimitive",
              data: { name: propName },
            });
          }
        }
      },
    };
  },
});
