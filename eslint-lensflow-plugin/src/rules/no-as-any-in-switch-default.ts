import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

export default createRule({
  name: "no-as-any-in-switch-default",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `as any` casts in switch default branches to enforce exhaustiveness checking",
    },
    messages: {
      noAsAny:
        "Using `as any` in a switch default branch bypasses exhaustiveness checking. Use an assertNever guard instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T01-algebraic-data-types.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"noAsAny", []>) {
    return {
      "SwitchCase[test=null] TSAsExpression > TSAnyKeyword"(
        node: TSESTree.TSAnyKeyword,
      ) {
        context.report({
          node: node.parent as TSESTree.TSAsExpression,
          messageId: "noAsAny",
        });
      },
    };
  },
});
