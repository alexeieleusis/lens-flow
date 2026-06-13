import type { TSESTree } from "@typescript-eslint/types";
import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

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
    type: "problem",
    docs: {
      description:
        "Require try/catch around await expressions in async generator functions",
    },
    messages: {
      missingTryCatch:
        "await in async generator must be wrapped in try/catch to prevent unhandled rejection and silent generator exit. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T64-async-iteration.md",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"missingTryCatch", []>) {
    return {
      AwaitExpression(node) {
        let current: TSESTree.Node | undefined = node.parent;
        while (current) {
          if (current.type === "TryStatement") {
            const inTry =
              current.block.range &&
              isInsideRange(current.block.range[0], current.block.range[1], node);
            const inCatch =
              current.handler?.body.range &&
              isInsideRange(
                current.handler.body.range[0],
                current.handler.body.range[1],
                node,
              );
            const inFinally =
              current.finalizer?.range &&
              isInsideRange(
                current.finalizer.range[0],
                current.finalizer.range[1],
                node,
              );
            if (inTry || inCatch || inFinally) return;
          }

          if (
            current.type === "FunctionDeclaration" ||
            current.type === "FunctionExpression" ||
            current.type === "ArrowFunctionExpression"
          ) {
            if (current.generator === true && current.async === true) {
              context.report({
                node,
                messageId: "missingTryCatch",
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
