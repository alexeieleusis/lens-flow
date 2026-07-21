import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T34-never-bottom.md");

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
        "Using `as any` in a switch default branch defeats exhaustiveness checking. Use an assertNever call instead. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"bypassExhaustiveness", []>) {
    return {
      TSAsExpression(node: TSESTree.TSAsExpression) {
        if (node.typeAnnotation.type !== "TSAnyKeyword") return;

        const ancestors = context.sourceCode.getAncestors(node);
        const innermostSwitchCase = [...ancestors]
          .reverse()
          .find((a) => a.type === "SwitchCase");
        if (innermostSwitchCase?.test === null) {
          context.report({
            node,
            messageId: "bypassExhaustiveness",
            data: { url: URL },
          });
        }
      },
    };
  },
});
