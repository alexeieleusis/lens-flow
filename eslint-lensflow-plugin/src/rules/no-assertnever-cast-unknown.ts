import { createRule } from "../utils/rule-creator.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

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
        "Casting to unknown before assertNever/assertExhaustive bypasses the exhaustiveness check. Remove the `as unknown` cast. See: https://raw.githubusercontent.com/jpablo/vibe-types/f5ab7f35de4cc4e292500398c8b2f6edab96c2db/plugin/skills/typescript/catalog/T34-never-bottom.md",
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
            });
          }
        }
      },
    };
  },
});
