import { createRule } from "../utils/rule-creator.js";
import { walk, walkNodes } from "../utils/ast-helpers.js";
import type { TSESLint } from "@typescript-eslint/utils";
import { TSESTree } from "@typescript-eslint/utils";

/**
 * Walk up parent chain to find an ancestor matching the predicate.
 */
function findAncestor(
  node: { parent?: unknown },
  predicate: (n: { type: string }) => boolean,
): { type: string } | null {
  let current: unknown = node.parent;
  while (current != null) {
    const obj = current as Record<string, unknown>;
    if (
      typeof obj === "object" &&
      "type" in obj &&
      predicate(obj as { type: string })
    ) {
      return obj as { type: string };
    }
    current = (obj as { parent?: unknown }).parent;
  }
  return null;
}

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
function isInsideConsoleCall(node: { parent?: unknown }): boolean {
  const call = findAncestor(node, (n) => n.type === "CallExpression");
  if (!call) return false;
  const callee = (call as { callee?: unknown }).callee;
  if (
    callee != null &&
    typeof callee === "object" &&
    (callee as { type?: string }).type === "MemberExpression"
  ) {
    const member = callee as { object?: { type?: string; name?: string } };
    return (
      member.object?.type === "Identifier" && member.object?.name === "console"
    );
  }
  return false;
}

export default createRule({
  name: "no-silent-error-catch",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow catch blocks that only log the error and throw a generic Error, discarding original error details.",
    },
    messages: {
      silentErrorCatch:
        "Error is only logged to console and replaced with a generic Error, losing original error details. Preserve or rethrow the original error. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC21-async-concurrency.md",
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
        if (!errorRefs.every((ref) => isInsideConsoleCall(ref))) return;

        // There must be a ThrowStatement with `new Error(...)` that does NOT
        // include the caught error parameter in its arguments.
        const hasGenericThrow = throwStmts.some((stmt) => {
          const arg = stmt.argument;
          if (!(arg && arg.type === "NewExpression")) return false;
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
        });
      },
    };
  },
});
