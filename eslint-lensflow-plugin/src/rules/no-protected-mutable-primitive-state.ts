import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

const PRIMITIVE_KEYWORDS = new Set([
  "TSNumberKeyword",
  "TSBooleanKeyword",
  "TSStringKeyword",
]);

function isPrimitiveUnion(node: unknown): node is { type: "TSUnionType"; types: unknown[] } {
  if (node && typeof node === "object" && "type" in node && node.type === "TSUnionType") {
    const types = ((node as unknown) as { types: unknown[] }).types;
    return Array.isArray(types) && types.every((t) => t && typeof t === "object" && "type" in t && PRIMITIVE_KEYWORDS.has((t as { type: string }).type));
  }
  return false;
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
        "Protected mutable primitive '{{name}}' allows subclasses to corrupt state without validation. Use a private field (#name) with a protected setter that validates input. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T21-encapsulation.md",
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
          if (member.readonly) continue;

          if (!member.value && !member.typeAnnotation) continue;

          const typeAnn = member.typeAnnotation?.typeAnnotation;
          if (
            typeAnn &&
            typeof typeAnn === "object" &&
            "type" in typeAnn &&
            (PRIMITIVE_KEYWORDS.has((typeAnn as { type: string }).type) ||
              isPrimitiveUnion(typeAnn))
          ) {
            const propName =
              member.key.type === "Identifier"
                ? member.key.name
                : member.key.type === "Literal"
                  ? String(member.key.value)
                  : "unknown";
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
