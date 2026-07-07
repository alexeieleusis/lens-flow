import { createRule } from "../utils/rule-creator.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

function isInsideRange(
  rangeStart: number,
  rangeEnd: number,
  node: TSESTree.AwaitExpression,
) {
  return node.range[0] >= rangeStart && node.range[1] <= rangeEnd;
}

export default createRule({
  name: "require-await-try-catch-in-generator",
  meta: {
    fixable: undefined,
    type: "problem",
    docs: {
      description:
        "Require try/catch around await expressions in async generator functions",
    },
    messages: {
      missingTryCatch:
        "await in async generator must be wrapped in try/catch to prevent unhandled rejection and silent generator exit. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T64-async-iteration.md",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"missingTryCatch", []>) {
    return {
      AwaitExpression(node) {
        const ancestors = context.sourceCode.getAncestors(node);
        for (let i = ancestors.length - 1; i >= 0; i--) {
          const current = ancestors[i];

          if (current.type === "TryStatement") {
            const tryNode = current as TSESTree.TryStatement;
            const inTry =
              tryNode.block.range &&
              isInsideRange(tryNode.block.range[0], tryNode.block.range[1], node);
            const inCatch =
              tryNode.handler?.body.range &&
              isInsideRange(
                tryNode.handler.body.range[0],
                tryNode.handler.body.range[1],
                node,
              );
            const inFinally =
              tryNode.finalizer?.range &&
              isInsideRange(
                tryNode.finalizer.range[0],
                tryNode.finalizer.range[1],
                node,
              );
            if (inTry || inCatch || inFinally) return;
          }

          if (
            current.type === "FunctionDeclaration" ||
            current.type === "FunctionExpression" ||
            current.type === "ArrowFunctionExpression"
          ) {
            const fn = current as TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression;
            if (fn.generator === true && fn.async === true) {
              context.report({
                node,
                messageId: "missingTryCatch",
              });
            }
            return;
          }
        }
      },
    };
  },
});
