import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { walkNodes } from "../utils/ast-helpers.js";

const SIGNAL_ACCEPTING_FUNCTIONS = new Set([
  // Network / stream APIs that accept { signal }
  "fetch",
  "open", // XMLHttpRequest.open
  "pipeTo",
  "pipeThrough",
  "cancel", // AbortSignal.abort's sibling
  "waitFor", // common in test runners
  "race", // Promise.race (commonly used with timeout patterns)
  "any", // Promise.any
  "all", // Promise.all
  "allSettled", // Promise.allSettled
  // Event / timer APIs
  "addEventListener",
  "setTimeout",
  "setInterval",
  // Common patterns
  "subscribe",
  "on",
  "once",
]);

function isSignalAcceptingCallee(
  callee: TSESTree.Expression,
): boolean {
  if (
    callee.type === "Identifier" &&
    SIGNAL_ACCEPTING_FUNCTIONS.has(callee.name)
  )
    return true;
  if (
    callee.type === "MemberExpression" &&
    callee.property.type === "Identifier" &&
    SIGNAL_ACCEPTING_FUNCTIONS.has(callee.property.name)
  )
    return true;
  return false;
}

function passedToFunction(
  body: TSESTree.BlockStatement | null,
  varName: string,
): boolean {
  if (!body) return false;

  return walkNodes(body, (node) => {
    if (node.type !== "CallExpression") return false;
    if (!isSignalAcceptingCallee(node.callee)) return false;
    return node.arguments.some((arg) => {
      // Direct: passed as `controller` to a signal-accepting function
      if (arg.type === "Identifier" && arg.name === varName) return true;
      // Via signal: passed as `controller.signal`
      if (
        arg.type === "MemberExpression" &&
        arg.object.type === "Identifier" &&
        arg.object.name === varName &&
        arg.property.type === "Identifier" &&
        arg.property.name === "signal"
      )
        return true;
      return false;
    });
  });
}

function hasAbortCall(
  body: TSESTree.BlockStatement | null,
  varName: string,
): boolean {
  if (!body) return false;

  return walkNodes(body, (node) => {
    return (
      node.type === "CallExpression" &&
      node.callee.type === "MemberExpression" &&
      node.callee.object.type === "Identifier" &&
      node.callee.object.name === varName &&
      node.callee.property.type === "Identifier" &&
      node.callee.property.name === "abort"
    );
  });
}

function findEnclosingFunctionBody(
  node: TSESTree.Node,
): TSESTree.BlockStatement | null {
  let current: TSESTree.Node | undefined = node;
  while (current) {
    if (
      current.type === "FunctionDeclaration" ||
      current.type === "FunctionExpression" ||
      current.type === "ArrowFunctionExpression"
    ) {
      const fn = current as
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression;
      if (
        fn.body.type === "BlockStatement" &&
        fn.body.body.length > 0
      ) {
        return fn.body;
      }
      return null;
    }
    current = current.parent;
  }
  return null;
}

export default createRule({
  name: "no-orphaned-abort-controller",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow creating an AbortController without ever calling .abort()",
    },
    messages: {
      orphanedAbortController:
        "AbortController '{{name}}' is never aborted, which may cause a memory leak. Ensure .abort() is called in a cleanup path (e.g., try/finally or a timeout callback). See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/usecases/UC21-async-concurrency.md",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"orphanedAbortController", []>) {
    return {
      NewExpression(node: TSESTree.NewExpression): void {
        if (
          node.callee.type !== "Identifier" ||
          node.callee.name !== "AbortController"
        ) {
          return;
        }

        const decl = node.parent;
        if (decl?.type !== "VariableDeclarator" || !decl.id) {
          return;
        }

        if (decl.id.type !== "Identifier") {
          return;
        }

        const varName = decl.id.name;
        const body = findEnclosingFunctionBody(node);

        if (!body) {
          return;
        }

        const hasAbort = hasAbortCall(body, varName);
        const passedOut = passedToFunction(body, varName);

        if (!hasAbort && !passedOut) {
          context.report({
            node,
            messageId: "orphanedAbortController",
            data: { name: varName },
          });
        }
      },
    };
  },
});
