import { createRule } from "../utils/rule-creator.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

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
        "Chaining `as any` in a type assertion bypasses type safety. Remove the `as any` intermediate cast. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T07-structural-typing.md",
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
            context.report({ node, messageId: "doubleCastAny" });
          }
        }
      },
    };
  },
});
