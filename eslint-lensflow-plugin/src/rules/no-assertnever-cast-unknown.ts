import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

const URL = knowledgeUrl("catalog/T34-never-bottom.md");

function containsUnknownCast(node: TSESTree.Node): boolean {
  if (node.type === "TSAsExpression") {
    if (node.typeAnnotation.type === "TSUnknownKeyword") return true;
    return containsUnknownCast(node.expression);
  }
  if (
    node.type === "TSSatisfiesExpression" ||
    node.type === "TSNonNullExpression" ||
    node.type === "ChainExpression"
  ) {
    return containsUnknownCast(node.expression);
  }
  return false;
}

export default createRule({
  name: "no-assertnever-cast-unknown",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow casting to unknown before passing to assertNever/assertExhaustive, which bypasses exhaustiveness checking",
    },
    messages: {
      bypassExhaustiveness:
        "Casting to unknown before assertNever/assertExhaustive bypasses the exhaustiveness check. Remove the `as unknown` cast. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"bypassExhaustiveness", []>) {
    return {
      CallExpression(node) {
        if (node.callee.type !== "Identifier") return;
        if (!/^assertNever$/.test(node.callee.name) && !/^assertExhaustive$/.test(node.callee.name)) {
          return;
        }
        for (const arg of node.arguments) {
          if (containsUnknownCast(arg)) {
            context.report({
              node: arg,
              messageId: "bypassExhaustiveness",
              data: { url: URL },
            });
          }
        }
      },
    };
  },
});
