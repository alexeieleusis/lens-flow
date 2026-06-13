import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "prefer-nullish-coalescing",
  meta: {
    type: "problem",
    docs: {
      description:
        "Prefer nullish coalescing (??) over logical OR (||) for default values",
    },
    messages: {
      preferNullishCoalescing:
        "Use ?? instead of || for default values. The || operator treats 0, \"\", and false as falsy. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/usecases/UC16-nullability.md",
    },
    schema: [],
    fixable: "code",
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"preferNullishCoalescing", []>) {
    return {
      LogicalExpression(node) {
        if (node.operator !== "||") return;

        // Skip chained boolean logic (left side is also a logical expression)
        if (node.left.type === "LogicalExpression") return;

        // Only flag when RHS is a literal (default-value pattern)
        if (node.right.type !== "Literal") return;

        context.report({
          node,
          messageId: "preferNullishCoalescing",
          fix: (fixer) => fixer.replaceText(node, `${context.sourceCode.getText(node.left)} ?? ${context.sourceCode.getText(node.right)}`),
        });
      },
    };
  },
});
