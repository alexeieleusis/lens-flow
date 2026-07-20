import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

const URL = knowledgeUrl("catalog/T64-async-iteration.md");

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
        "await in async generator must be wrapped in try/catch to prevent unhandled rejection and silent generator exit. See: {{url}}",
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
            const fn = current as TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression;
            if (fn.generator === true && fn.async === true) {
              context.report({
                node,
                messageId: "missingTryCatch",
                data: { url: URL },
              });
            }
            return;
          }
        }
      },
    };
  },
});
