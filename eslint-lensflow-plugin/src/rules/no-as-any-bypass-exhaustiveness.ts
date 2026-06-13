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
      TSAsExpression(node: TSESTree.TSAsExpression) {
        if (node.typeAnnotation.type !== "TSAnyKeyword") return;

        let current: TSESTree.Node | undefined = node.parent;
        while (current) {
          if (current.type === "SwitchCase") {
            if (current.test === null) {
              context.report({
                node,
                messageId: "bypassExhaustiveness",
              });
            }
            return;
          }
          current = current.parent;
        }
      },
    };
  },
});
