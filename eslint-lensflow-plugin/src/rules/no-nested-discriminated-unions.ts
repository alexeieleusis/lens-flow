import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

function getPropertyName(key: TSESTree.TSPropertySignature["key"]): string {
  if (key.type === "Identifier") return key.name;
  if (key.type === "Literal" && typeof key.value === "string") return String(key.value);
  return "";
}

function hasKindProperty(typeNode: TSESTree.TypeNode): boolean {
  if (typeNode.type !== "TSTypeLiteral") return false;
  return typeNode.members.some(
    (member) =>
      member.type === "TSPropertySignature" &&
      !member.computed &&
      getPropertyName(member.key) === "kind",
  );
}

function isNestedDiscriminatedUnion(typeNode: TSESTree.TypeNode): boolean {
  if (typeNode.type === "TSUnionType") {
    return typeNode.types.some(
      (member) =>
        member.type === "TSTypeLiteral" &&
        hasKindProperty(member),
    );
  }
  return false;
}

export default createRule({
  name: "no-nested-discriminated-unions",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow deeply nested discriminated unions where a union member's field is itself a discriminated union",
    },
    messages: {
      nestedDiscriminatedUnion:
        "Found a nested discriminated union inside a union member. Flatten the discriminant variants into separate top-level union members instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC01-invalid-states.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"nestedDiscriminatedUnion", []>) {
    return {
      TSUnionType(node) {
        for (const member of node.types) {
          if (member.type !== "TSTypeLiteral") continue;

          let reported = false;

          for (const prop of member.members) {
            if (
              prop.type !== "TSPropertySignature" ||
              !prop.typeAnnotation
            )
              continue;

            const annotation = prop.typeAnnotation.typeAnnotation;
            if (isNestedDiscriminatedUnion(annotation)) {
              if (!reported) {
                context.report({
                  node: member,
                  messageId: "nestedDiscriminatedUnion",
                });
                reported = true;
              }
            }
          }
        }
      },
    };
  },
});
