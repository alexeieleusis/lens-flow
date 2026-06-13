import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "prefer-as-const",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer `as const` over explicit object type assertion on object literals",
    },
    messages: {
      preferAsConst:
        "Prefer `as const` instead of explicit object type assertion on an object literal. This preserves literal types without manual annotation. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T18-conversions-coercions.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"preferAsConst", []>) {
    return {
      TSAsExpression(node) {
        if (
          node.expression.type === "ObjectExpression" &&
          node.typeAnnotation.type === "TSTypeLiteral"
        ) {
          context.report({
            node,
            messageId: "preferAsConst",
          });
        }
      },
    };
  },
});
