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
        "Cannot assign to readonly field '{{field}}' outside the constructor. readonly fields can only be assigned at declaration or in the constructor. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T32-immutability-markers.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"mutationOfReadonly", []>) {
    const readonlyFieldsStack: (Set<string> | null)[] = [];
    let constructorDepth = 0;

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

          if (
            member.type === "MethodDefinition" &&
            member.kind === "constructor" &&
            member.value
          ) {
            for (const param of member.value.params) {
              if (param.type === "TSParameterProperty") {
                const inner = param.parameter;
                if (inner.type === "Identifier") {
                  readonlyFields.add(inner.name);
                }
              }
            }
          }
        }

        readonlyFieldsStack.push(readonlyFields.size > 0 ? readonlyFields : null);
      },
      "ClassBody:exit"() {
        readonlyFieldsStack.pop();
      },
      MethodDefinition(node) {
        if (node.kind === "constructor") {
          constructorDepth++;
        }
      },
      "MethodDefinition:exit"(node) {
        if (node.kind === "constructor") {
          constructorDepth--;
        }
      },
      AssignmentExpression(node) {
        const currentReadonlyFields = readonlyFieldsStack[readonlyFieldsStack.length - 1];
        if (!currentReadonlyFields || constructorDepth > 0) return;

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
        const currentReadonlyFields = readonlyFieldsStack[readonlyFieldsStack.length - 1];
        if (!currentReadonlyFields || constructorDepth > 0) return;

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
