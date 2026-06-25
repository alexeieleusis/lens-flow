import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

function testsEqual(
  context: Parameters<ReturnType<typeof createRule>["create"]>[0],
  a: TSESTree.Node,
  b: TSESTree.Node,
): boolean {
  if (a.type !== b.type) return false;

  return context.sourceCode.getText(a) === context.sourceCode.getText(b);
}

export default createRule({
  name: "no-redundant-narrowing",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow redundant narrowing checks that repeat an outer block's identical check (binary comparisons, typeof, instanceof, truthiness, and call expressions)",
    },
    messages: {
      redundantNarrowing:
        "This narrowing check is redundant because an outer block already performed the same check. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T14-type-narrowing.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"redundantNarrowing", []>) {
    return {
      IfStatement(node) {
        if (node.consequent.type !== "BlockStatement") return;

        for (const stmt of node.consequent.body) {
          if (stmt.type === "IfStatement" && testsEqual(context, node.test, stmt.test)) {
            context.report({
              node: stmt,
              messageId: "redundantNarrowing",
            });
          }
        }
      },
    };
  },
});
