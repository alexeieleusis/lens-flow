import { createRule } from "../utils/rule-creator.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

function extractFieldName(key: TSESTree.Node): string | null {
  if (key.type === "Identifier") return key.name;
  if (key.type === "PrivateIdentifier") return key.name;
  if (key.type === "Literal" && typeof key.value === "string") return key.value;
  return null;
}

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
            member.readonly
          ) {
            const fieldName = extractFieldName(member.key);
            if (fieldName) {
              readonlyFields.add(fieldName);
            }
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
          node.left.object.type === "ThisExpression"
        ) {
          const fieldName = extractFieldName(node.left.property);
          if (fieldName && currentReadonlyFields.has(fieldName)) {
            context.report({
              node,
              messageId: "mutationOfReadonly",
              data: {
                field: fieldName,
              },
            });
          }
        }
      },
      UpdateExpression(node) {
        const currentReadonlyFields = readonlyFieldsStack[readonlyFieldsStack.length - 1];
        if (!currentReadonlyFields || constructorDepth > 0) return;

        if (
          node.argument.type === "MemberExpression" &&
          node.argument.object.type === "ThisExpression"
        ) {
          const fieldName = extractFieldName(node.argument.property);
          if (fieldName && currentReadonlyFields.has(fieldName)) {
            context.report({
              node,
              messageId: "mutationOfReadonly",
              data: {
                field: fieldName,
              },
            });
          }
        }
      },
    };
  },
});
