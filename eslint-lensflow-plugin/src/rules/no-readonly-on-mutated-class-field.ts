import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "no-readonly-on-mutated-class-field",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow mutating a readonly class field outside the constructor",
    },
    messages: {
      mutationOfReadonly:
        "Cannot assign to readonly field '{{field}}' outside the constructor. readonly fields can only be assigned at declaration or in the constructor. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T32-immutability-markers.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"mutationOfReadonly", []>) {
    let currentReadonlyFields: Set<string> | null = null;
    let isInConstructor = false;

    return {
      ClassBody(node) {
        const readonlyFields = new Set<string>();

        for (const member of node.body) {
          if (
            member.type === "PropertyDefinition" &&
            member.readonly &&
            member.key.type === "Identifier"
          ) {
            readonlyFields.add(member.key.name);
          }
        }

        currentReadonlyFields = readonlyFields.size > 0 ? readonlyFields : null;
      },
      "ClassBody:exit"() {
        currentReadonlyFields = null;
      },
      MethodDefinition(node) {
        if (node.kind === "constructor") {
          isInConstructor = true;
        }
      },
      "MethodDefinition:exit"(node) {
        if (node.kind === "constructor") {
          isInConstructor = false;
        }
      },
      AssignmentExpression(node) {
        if (!currentReadonlyFields || isInConstructor) return;

        if (
          node.left.type === "MemberExpression" &&
          node.left.object.type === "ThisExpression" &&
          node.left.property.type === "Identifier" &&
          currentReadonlyFields.has(node.left.property.name)
        ) {
          context.report({
            node,
            messageId: "mutationOfReadonly",
            data: {
              field: node.left.property.name,
            },
          });
        }
      },
      UpdateExpression(node) {
        if (!currentReadonlyFields || isInConstructor) return;

        if (
          node.argument.type === "MemberExpression" &&
          node.argument.object.type === "ThisExpression" &&
          node.argument.property.type === "Identifier" &&
          currentReadonlyFields.has(node.argument.property.name)
        ) {
          context.report({
            node,
            messageId: "mutationOfReadonly",
            data: {
              field: node.argument.property.name,
            },
          });
        }
      },
    };
  },
});
