import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

export default createRule({
  name: "no-as-any-bypass-exhaustiveness",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `as any` in the default branch of a switch to prevent bypassing exhaustiveness checks",
    },
    messages: {
      bypassExhaustiveness:
        "Using `as any` in a switch default branch defeats exhaustiveness checking. Use an assertNever call instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T34-never-bottom.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"bypassExhaustiveness", []>) {
    return {
      "SwitchCase[test=null] TSAsExpression > TSAnyKeyword"(
        node: TSESTree.TSAnyKeyword,
      ) {
        context.report({
          node: node.parent as TSESTree.TSAsExpression,
          messageId: "bypassExhaustiveness",
        });
      },
    };
  },
});
