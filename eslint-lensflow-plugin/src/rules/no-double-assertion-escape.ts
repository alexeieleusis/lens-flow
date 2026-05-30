import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "no-double-assertion-escape",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `as unknown as T` double assertions that bypass the type system",
    },
    messages: {
      doubleAssertionEscape:
        "Do not use `as unknown as T` to bypass the type system. Use a validated conversion function instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T12-effect-tracking.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"doubleAssertionEscape", []>) {
    return {
      TSAsExpression(node) {
        if (
          node.expression.type === "TSAsExpression" &&
          node.expression.typeAnnotation?.type === "TSUnknownKeyword"
        ) {
          context.report({
            node,
            messageId: "doubleAssertionEscape",
          });
        }
      },
    };
  },
});
