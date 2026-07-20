import { createRule } from "../utils/rule-creator.js";
import { walk, walkNodes } from "../utils/ast-helpers.js";
import type { TSESLint } from "@typescript-eslint/utils";
import { TSESTree } from "@typescript-eslint/utils";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("usecases/UC21-async-concurrency.md");

/**
 * Check whether any descendant of the given node is an Identifier with the specified name.
 * Stops at function boundaries to avoid crossing scope.
 */
function nodeContainsIdentifier(
  node: TSESTree.Node,
  name: string,
): boolean {
  return walkNodes(node, (n) =>
    n.type === "Identifier" && n.name === name,
  );
}

/**
 * Check whether an Identifier reference is used inside a console.* call.
 */
function isInsideConsoleCall(
  sourceCode: TSESLint.SourceCode,
  node: TSESTree.Node,
): boolean {
  const ancestors = sourceCode.getAncestors(node);
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const ancestor = ancestors[i];
    if (ancestor.type === "CallExpression") {
      const callee = ancestor.callee;
      if (
        callee.type === "MemberExpression" &&
        callee.object.type === "Identifier" &&
        callee.object.name === "console"
      ) {
        return true;
      }
      return false;
    }
  }
  return false;
}

export default createRule({
  name: "no-silent-error-catch",
  meta: {
    type: "problem",
    fixable: undefined,
    docs: {
      description:
        "Disallow catch blocks that only log the error and throw a generic Error, discarding original error details.",
    },
    messages: {
      silentErrorCatch:
        "Error is only logged to console and replaced with a generic Error, losing original error details. Preserve or rethrow the original error. See: {{url}}",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"silentErrorCatch", []>) {
    return {
      CatchClause(node) {
        if (node.param?.type !== "Identifier") return;

        const paramName = node.param.name;

        // Collect error references and throw statements, stopping at function boundaries.
        const errorRefs: TSESTree.Identifier[] = [];
        const throwStmts: TSESTree.ThrowStatement[] = [];

        walk(node.body, (n) => {
          if (n.type === "Identifier" && n.name === paramName) {
            errorRefs.push(n);
          }
          if (n.type === "ThrowStatement") {
            throwStmts.push(n);
          }
        });

        if (errorRefs.length === 0) return;

        // All references must be inside console.* calls.
        const sourceCode = context.sourceCode;
        if (!errorRefs.every((ref) => isInsideConsoleCall(sourceCode, ref))) return;

        // There must be a ThrowStatement with `new Error(...)` that does NOT
        // include the caught error parameter in its arguments.
        const hasGenericThrow = throwStmts.some((stmt) => {
          const arg = stmt.argument;
          if (arg?.type !== "NewExpression") return false;
          if (
            arg.callee.type !== "Identifier" ||
            arg.callee.name !== "Error"
          )
            return false;

          // Check that none of the Error constructor args contain the error param.
          const hasErrorRef = arg.arguments.some(
            (argNode) => nodeContainsIdentifier(argNode, paramName),
          );
          return !hasErrorRef;
        });

        if (!hasGenericThrow) return;

        context.report({
          node,
          messageId: "silentErrorCatch",
          data: { url: URL },
        });
      },
    };
  },
});
