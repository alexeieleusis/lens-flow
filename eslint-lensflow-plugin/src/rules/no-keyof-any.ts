import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "no-keyof-any",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `keyof any` which resolves to `string | number | symbol` and defeats key-based constraints",
    },
    messages: {
      keyofAny:
        "`keyof any` resolves to `string | number | symbol`, defeating key-based constraints. Use `keyof T` to constrain to the type's keys instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T04-generics-bounds.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"keyofAny", []>) {
    return {
      TSTypeOperator(node) {
        if (node.operator === "keyof" && node.typeAnnotation && node.typeAnnotation.type === "TSAnyKeyword") {
          context.report({ node, messageId: "keyofAny" });
        }
      },
    };
  },
});
