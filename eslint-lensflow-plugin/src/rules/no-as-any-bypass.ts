import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESLint } from "@typescript-eslint/utils";

const URL = knowledgeUrl("usecases/UC01-invalid-states.md");

export default createRule({
  name: "no-as-any-bypass",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow casting to `any` as an intermediate step to bypass type validation",
    },
    messages: {
      anyCast:
        "Casting to `any` defeats type safety. Avoid using `as any`. See: {{url}}",
      doubleCastBypass:
        "Double-cast through `any` bypasses validation, defeating branded types and illegal-state prevention. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"doubleCastBypass" | "anyCast", []>) {
    return {
      TSAsExpression(node) {
        const isAnyCast = node.typeAnnotation.type === "TSAnyKeyword";
        const hasAnyIntermediate =
          node.expression.type === "TSAsExpression" &&
          node.expression.typeAnnotation.type === "TSAnyKeyword";

        if (hasAnyIntermediate) {
          context.report({
            node,
            messageId: "doubleCastBypass",
            data: { url: URL },
          });
        } else if (isAnyCast) {
          const parentIsAsExpression =
            node.parent?.type === "TSAsExpression";

          if (!parentIsAsExpression) {
            context.report({
              node,
              messageId: "anyCast",
              data: { url: URL },
            });
          }
        }
      },
    };
  },
});
