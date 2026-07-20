import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { walkNodes } from "../utils/ast-helpers.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("usecases/UC08-error-handling.md");

const stringMatchMethods = new Set([
  "includes",
  "indexOf",
  "match",
  "search",
  "startsWith",
  "endsWith",
  "test",
]);

function isStringMatchCall(
  node: TSESTree.CallExpression,
  catchParamName: string,
): boolean {
  const callee = node.callee;
  if (callee.type !== "MemberExpression" || callee.computed) return false;
  if (callee.property.type !== "Identifier") return false;
  if (!stringMatchMethods.has(callee.property.name)) return false;

  const obj = callee.object;
  if (obj.type !== "MemberExpression" || obj.computed) return false;
  if (obj.property.type !== "Identifier") return false;
  if (obj.property.name !== "message" && obj.property.name !== "name") return false;
  if (obj.object.type !== "Identifier") return false;
  if (obj.object.name !== catchParamName) return false;

  return true;
}

/**
 * Checks whether a node is inside a nested TryStatement's catch handler
 * within the given root node. This prevents attributing inner catch-block
 * string matches to the outer catch scope.
 */
function isInsideNestedCatchHandler(
  target: TSESTree.Node,
  root: TSESTree.Node,
): boolean {
  return walkNodes(root, (node) => {
    if (node.type === "TryStatement" && node !== root && node.handler?.param) {
      return walkNodes(node.handler.body, (n) => n === target);
    }
    return false;
  });
}

export default createRule({
  name: "no-string-match-error-handling",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow matching error types by string searching on error.message or error.name in catch blocks",
    },
    messages: {
      stringMatchOnError:
        "Do not match error types by string searching on error.message or error.name. Use typed discriminated unions with exhaustive switch instead. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"stringMatchOnError", []>) {
    return {
      TryStatement(node) {
        if (!node.handler) return;

        const catchParam = node.handler.param;
        if (catchParam?.type !== "Identifier") return;

        const catchParamName = catchParam.name;
        const catchBody = node.handler.body;

        const found = walkNodes(catchBody, (child) => {
          if (
            child.type === "CallExpression" &&
            isStringMatchCall(child, catchParamName)
          ) {
            // Exclude matches that live inside a nested catch handler
            if (isInsideNestedCatchHandler(child, catchBody)) return false;
            return true;
          }
          return false;
        });

        if (found) {
          context.report({
            node,
            messageId: "stringMatchOnError",
            data: { url: URL },
          });
        }
      },
    };
  },
});
