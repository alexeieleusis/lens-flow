import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

function isAstNode(val: unknown): val is { type: string } {
  return (
    val !== null &&
    typeof val === "object" &&
    "type" in val &&
    typeof (val as { type: unknown }).type === "string"
  );
}

/**
 * Recursively collect all descendant nodes (excluding parent/backward references).
 */
function collectDescendants(root: { type: string }): Array<{ type: string }> {
  const result: Array<{ type: string }> = [];
  const stack: Array<{ type: string }> = [];

  const nonNodeProps = new Set([
    "parent",
    "loc",
    "range",
    "leadingComments",
    "trailingComments",
    "innerComments",
  ]);

  const pushChildren = (node: { type: string }) => {
    for (const [key, val] of Object.entries(node)) {
      if (nonNodeProps.has(key)) continue;
      if (Array.isArray(val)) {
        for (const item of val) {
          if (isAstNode(item)) stack.push(item);
        }
      } else if (isAstNode(val)) {
        stack.push(val);
      }
    }
  };

  pushChildren(root);
  while (stack.length > 0) {
    const node = stack.pop()!;
    result.push(node);
    pushChildren(node);
  }

  return result;
}

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
 */
function nodeContainsIdentifier(
  node: { type: string },
  name: string,
): boolean {
  const descendants = collectDescendants(node);
  return descendants.some(
    (d) =>
      d.type === "Identifier" && (d as { name?: string }).name === name,
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

        // Collect all descendants of the catch body (not the param itself).
        const allDescendants = collectDescendants(node.body);

        // Find all references to the error parameter in the body.
        const errorRefs = allDescendants.filter(
          (d) =>
            d.type === "Identifier" &&
            (d as { name?: string }).name === paramName,
        );

        if (errorRefs.length === 0) return;

        // All references must be inside console.* calls.
        const allInsideConsole = errorRefs.every((ref) => isInsideConsoleCall(ref as { parent?: unknown }));
        if (!allInsideConsole) return;

        // There must be a ThrowStatement with `new Error(...)` that does NOT
        // include the caught error parameter in its arguments.
        const throwStmts = allDescendants.filter(
          (d) => d.type === "ThrowStatement",
        );
        const hasGenericThrow = throwStmts.some((stmt) => {
          const arg = (stmt as { argument?: unknown }).argument;
          if (
            arg == null ||
            typeof arg !== "object" ||
            (arg as { type?: string }).type !== "NewExpression"
          )
            return false;

          const newExpr = arg as {
            callee?: { type?: string; name?: string };
            arguments?: unknown[];
          };
          if (
            newExpr.callee?.type !== "Identifier" ||
            newExpr.callee?.name !== "Error"
          )
            return false;

          // Check that none of the Error constructor args contain the error param.
          const args = newExpr.arguments ?? [];
          const hasErrorRef = args.some(
            (argNode) =>
              isAstNode(argNode) && nodeContainsIdentifier(argNode, paramName),
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
