import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "prefer-explicit-interface-annotation-t59",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer explicit type annotation over `satisfies` when satisfying a named interface or type alias.",
    },
    messages: {
      preferAnnotation:
        "Use an explicit type annotation instead of `satisfies` with a named type `{{typeName}}`. An explicit annotation more reliably hides excess properties from inference. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T59-existential-types.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"preferAnnotation", []>) {
    return {
      TSSatisfiesExpression(node) {
        const typeAnnotation = node.typeAnnotation;

        if (
          typeAnnotation.type === "TSTypeReference" &&
          typeAnnotation.typeName.type === "Identifier"
        ) {
          const typeName = typeAnnotation.typeName.name;
          context.report({
            node,
            messageId: "preferAnnotation",
            data: { typeName },
          });
        }
      },
    };
  },
});
