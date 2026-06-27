import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

export default createRule({
  name: "require-union-discriminant",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Require union members that are object types to have at least one literal-typed discriminant property.",
    },
    messages: {
      missingDiscriminant:
        "Union of object types has no member with a literal-typed discriminant property. Add a discriminant (e.g. `kind: \"circle\"`) to enable exhaustive narrowing. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T07-structural-typing.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"missingDiscriminant", []>) {
    return {
      TSUnionType(node) {
        const typeLiterals = node.types.filter(
          (member): member is TSESTree.TSTypeLiteral =>
            member.type === "TSTypeLiteral",
        );

        if (typeLiterals.length < 2) return;

        const hasAllDiscriminant = typeLiterals.every((member) =>
          member.members.some(
            (sig) =>
              sig.type === "TSPropertySignature" &&
              sig.typeAnnotation?.typeAnnotation?.type === "TSLiteralType" &&
              sig.typeAnnotation.typeAnnotation.literal.type === "Literal" &&
              (typeof sig.typeAnnotation.typeAnnotation.literal.value === "string" ||
                typeof sig.typeAnnotation.typeAnnotation.literal.value === "number" ||
                typeof sig.typeAnnotation.typeAnnotation.literal.value === "boolean"),
          ),
        );

        if (!hasAllDiscriminant) {
          context.report({
            node,
            messageId: "missingDiscriminant",
          });
        }
      },
    };
  },
});
