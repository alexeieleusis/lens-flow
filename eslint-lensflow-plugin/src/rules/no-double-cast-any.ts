import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESLint } from "@typescript-eslint/utils";

const URL = knowledgeUrl("catalog/T47-gradual-typing.md");

export default createRule({
  name: "no-double-cast-any",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow double-cast through `any` (`value as any as T` or `value as T as any`) which bypasses all structural type checking",
    },
    messages: {
      doubleCastAny:
        "Double-cast through `any` bypasses structural type checking. Use a single `as` cast or a type guard instead. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"doubleCastAny", []>) {
    return {
      TSAsExpression(node) {
        const expr = node.expression;

        if (expr.type === "TSAsExpression") {
          if (expr.typeAnnotation.type === "TSAnyKeyword") {
            context.report({
              node,
              messageId: "doubleCastAny",
              data: { url: URL },
            });
            return;
          }

          if (node.typeAnnotation.type === "TSAnyKeyword") {
            context.report({
              node,
              messageId: "doubleCastAny",
              data: { url: URL },
            });
          }
        }
      },
    };
  },
});
