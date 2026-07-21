import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESLint } from "@typescript-eslint/utils";

const URL = knowledgeUrl("usecases/UC16-nullability.md");

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
        'Use ?? instead of || for default values. The || operator treats 0, "", and false as falsy. See: {{url}}',
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
          data: { url: URL },
          fix: (fixer) =>
            fixer.replaceText(
              node,
              `${context.sourceCode.getText(node.left)} ?? ${context.sourceCode.getText(node.right)}`,
            ),
        });
      },
    };
  },
});
