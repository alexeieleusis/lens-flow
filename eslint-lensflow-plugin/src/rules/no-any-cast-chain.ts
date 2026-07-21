import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

const URL = knowledgeUrl("catalog/T07-structural-typing.md");

/**
 * @deprecated Use `no-double-cast-any` instead.
 * Disallow chaining `as any` casts which bypass type safety entirely.
 */
export default createRule({
  name: "no-any-cast-chain",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow chaining `as any` casts which bypass type safety entirely.",
    },
    messages: {
      doubleCastAny:
        "Chaining `as any` in a type assertion bypasses type safety. Remove the `as any` intermediate cast. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"doubleCastAny", []>) {
    return {
      TSAsExpression(node: TSESTree.TSAsExpression) {
        if (node.expression.type === "TSAsExpression") {
          const inner = node.expression;
          if (
            inner.typeAnnotation.type === "TSAnyKeyword" ||
            node.typeAnnotation.type === "TSAnyKeyword"
          ) {
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
