import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "no-reuse-generator",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow reusing an async generator instance across multiple for await...of loops",
    },
    messages: {
      reuseGenerator:
        "Async generator instance '{{name}}' is reused in a second for await...of loop. Generators are single-use; the second iteration yields nothing. Create a fresh instance per loop. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T64-async-iteration.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"reuseGenerator", []>) {
    const callExprVars = new Set<string>();
    const forAwaitOfCounts = new Map<string, number>();

    return {
      VariableDeclarator(node) {
        if (
          node.init &&
          node.id.type === "Identifier" &&
          (node.init.type === "CallExpression" ||
            node.init.type === "NewExpression")
        ) {
          callExprVars.add(node.id.name);
        }
      },

      ForOfStatement(node) {
        if (!node.await) return;

        const right = node.right;
        if (right.type !== "Identifier") return;

        const varName = right.name;

        if (!callExprVars.has(varName)) return;

        const currentCount = (forAwaitOfCounts.get(varName) ?? 0) + 1;
        forAwaitOfCounts.set(varName, currentCount);

        if (currentCount >= 2) {
          context.report({
            node,
            messageId: "reuseGenerator",
            data: { name: varName },
          });
        }
      },
    };
  },
});
