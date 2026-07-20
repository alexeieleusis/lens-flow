import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { walkNodes } from "../utils/ast-helpers.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("usecases/UC21-async-concurrency.md");

function isSameVariable(
  ident: TSESTree.Identifier,
  target: TSESLint.Scope.Variable,
  sourceCode: TSESLint.SourceCode,
): boolean {
  const scope = sourceCode.getScope(ident);
  let current: TSESLint.Scope.Scope | null = scope;
  while (current) {
    for (const v of current.variables) {
      if (v.name === ident.name) return v === target;
    }
    current = current.upper;
  }
  return false;
}

function isSameVariableMemberExpression(
  me: TSESTree.MemberExpression,
  target: TSESLint.Scope.Variable,
  sourceCode: TSESLint.SourceCode,
): boolean {
  if (me.object.type !== "Identifier") return false;
  return isSameVariable(me.object, target, sourceCode);
}

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

function isSignalArg(
  arg: TSESTree.Node,
  controllerVar: TSESLint.Scope.Variable,
  sourceCode: TSESLint.SourceCode,
): boolean {
  if (
    arg.type === "Identifier" &&
    isSameVariable(arg, controllerVar, sourceCode)
  )
    return true;
  if (
    arg.type === "MemberExpression" &&
    arg.property.type === "Identifier" &&
    arg.property.name === "signal" &&
    isSameVariableMemberExpression(arg, controllerVar, sourceCode)
  )
    return true;
  if (arg.type === "ObjectExpression") {
    for (const prop of arg.properties) {
      if (
        prop.type === "Property" &&
        prop.key.type === "Identifier" &&
        prop.key.name === "signal" &&
        prop.value.type === "MemberExpression" &&
        prop.value.property.type === "Identifier" &&
        prop.value.property.name === "signal" &&
        isSameVariableMemberExpression(prop.value, controllerVar, sourceCode)
      )
        return true;
    }
  }
  return false;
}

function passedToFunction(
  body: TSESTree.BlockStatement | null,
  controllerVar: TSESLint.Scope.Variable,
  sourceCode: TSESLint.SourceCode,
): boolean {
  if (!body) return false;

  return walkNodes(body, (node) => {
    if (node.type !== "CallExpression") return false;
    if (!isSignalAcceptingCallee(node.callee)) return false;
    return node.arguments.some((arg) =>
      isSignalArg(arg, controllerVar, sourceCode),
    );
  }, { stopAtFunctionBoundaries: true });
}

function hasAbortCall(
  body: TSESTree.BlockStatement | null,
  controllerVar: TSESLint.Scope.Variable,
  sourceCode: TSESLint.SourceCode,
): boolean {
  if (!body) return false;

  return walkNodes(body, (node) => {
    return (
      node.type === "CallExpression" &&
      node.callee.type === "MemberExpression" &&
      node.callee.property.type === "Identifier" &&
      node.callee.property.name === "abort" &&
      isSameVariableMemberExpression(
        node.callee,
        controllerVar,
        sourceCode,
      )
    );
  }, { stopAtFunctionBoundaries: true });
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
        "AbortController '{{name}}' is never aborted, which may cause a memory leak. Ensure .abort() is called in a cleanup path (e.g., try/finally or a timeout callback). See: {{url}}",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"orphanedAbortController", []>) {
    const sourceCode = context.sourceCode;

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
          // Inline `new AbortController().signal` — no variable reference, always orphaned
          if (
            node.parent?.type === "MemberExpression" &&
            node.parent.property.type === "Identifier" &&
            node.parent.property.name === "signal"
          ) {
            context.report({
              node,
              messageId: "orphanedAbortController",
              data: { name: "(inline)", url: URL },
            });
          }
          return;
        }

        if (decl.id.type !== "Identifier") {
          return;
        }

        const varName = decl.id.name;

        const controllerVars = sourceCode.getDeclaredVariables(decl);
        const controllerVar = controllerVars.find(
          (v: TSESLint.Scope.Variable) => v.name === varName,
        );
        if (!controllerVar) {
          return;
        }

        const body = findEnclosingFunctionBody(node);

        if (!body) {
          return;
        }

        const hasAbort = hasAbortCall(body, controllerVar, sourceCode);
        const passedOut = passedToFunction(body, controllerVar, sourceCode);

        if (!hasAbort && !passedOut) {
          context.report({
            node,
            messageId: "orphanedAbortController",
            data: { name: varName, url: URL },
          });
        }
      },
    };
  },
});
