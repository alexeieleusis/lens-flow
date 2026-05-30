import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "no-any-cast-chain",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow chained type assertions through `any` that bypass typestate safety",
    },
    messages: {
      anyCastChain:
        "Chained type assertion through `any` bypasses all type safety guarantees. Use the proper type API instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T57-typestate.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"anyCastChain", []>) {
    return {
      TSAsExpression(node) {
        const expr = node.expression;

        if (expr.type === "TSAsExpression") {
          if (expr.typeAnnotation.type === "TSAnyKeyword") {
            context.report({ node, messageId: "anyCastChain" });
            return;
          }

          if (node.typeAnnotation.type === "TSAnyKeyword") {
            context.report({ node, messageId: "anyCastChain" });
          }
        }
      },
    };
  },
});
