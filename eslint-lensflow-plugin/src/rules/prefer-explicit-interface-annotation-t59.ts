import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "prefer-explicit-interface-annotation-t59",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer explicit type annotation over `satisfies` when satisfying a named type reference.",
    },
    messages: {
      preferAnnotation:
        "Use an explicit type annotation instead of `satisfies` with a named type `{{typeName}}`. An explicit annotation more reliably hides excess properties from inference. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T59-existential-types.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"preferAnnotation", []>) {
    return {
      TSSatisfiesExpression(node) {
        const typeAnnotation = node.typeAnnotation;

        if (typeAnnotation.type === "TSTypeReference") {
          const typeNameNode = typeAnnotation.typeName;
          if (typeNameNode.type !== "Identifier") return;
          context.report({
            node,
            messageId: "preferAnnotation",
            data: { typeName: typeNameNode.name },
          });
        }
      },
    };
  },
});
