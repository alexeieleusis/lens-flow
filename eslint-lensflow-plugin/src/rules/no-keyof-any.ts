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
        "`keyof any` resolves to `string | number | symbol`, defeating key-based constraints. Use `keyof T` to constrain to the type's keys instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T04-generics-bounds.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"keyofAny", []>) {
    return {
      TSTypeOperator(node) {
        if (
          node.operator === "keyof" &&
          node.typeAnnotation &&
          typeof node.typeAnnotation === "object" &&
          "type" in node.typeAnnotation &&
          node.typeAnnotation.type === "TSAnyKeyword"
        ) {
          context.report({ node, messageId: "keyofAny" });
        }
      },
    };
  },
});
