import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

function isASTNode(val: unknown): val is TSESTree.Node {
  return typeof val === "object" && val !== null && "type" in val;
}

function collectChildIdentifiers(
  node: TSESTree.Node,
  visited: WeakSet<object>,
): string[] {
  const ids: string[] = [];
  for (const key of Object.keys(node)) {
    if (key === "parent") continue;
    const val = (node as unknown as Record<string, unknown>)[key];
    if (Array.isArray(val)) {
      for (const item of val) {
        if (isASTNode(item)) {
          ids.push(...collectIdentifiers(item, visited));
        }
      }
    } else if (isASTNode(val)) {
      ids.push(...collectIdentifiers(val, visited));
    }
  }
  return ids;
}

function collectIdentifiers(node: TSESTree.Node, visited = new WeakSet<object>()): string[] {
  if (visited.has(node)) return [];
  visited.add(node);

  const ids: string[] = [];
  if (node.type === "Identifier") {
    ids.push(node.name);
  }
  ids.push(...collectChildIdentifiers(node, visited));
  return ids;
}

function reportEatenErrorIfApplicable(
  callback: TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression,
  errorParam: string | undefined,
  context: Parameters<ReturnType<typeof createRule>["create"]>[0],
) {
  if (callback.body.type === "BlockStatement") {
    const { body } = callback.body;
    const isEmptyOrOnlyEmpty = body.every((stmt) => stmt.type === "EmptyStatement");

    if (isEmptyOrOnlyEmpty) {
      context.report({
        node: callback,
        messageId: "emptyCatch",
      });
      return;
    }

    const bodyIdentifiers = body.flatMap((stmt) => collectIdentifiers(stmt));
    if (errorParam && !bodyIdentifiers.includes(errorParam)) {
      context.report({
        node: callback,
        messageId: "ignoredParam",
        data: { param: errorParam },
      });
    }
  } else {
    const bodyIdentifiers = collectIdentifiers(callback.body);
    if (errorParam && !bodyIdentifiers.includes(errorParam)) {
      context.report({
        node: callback,
        messageId: "ignoredParam",
        data: { param: errorParam },
      });
    }
  }
}

export default createRule({
  name: "no-eaten-callback-error",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow .catch() handlers that silently swallow errors",
    },
    messages: {
      emptyCatch:
        "The .catch() handler has an empty body and silently swallows errors. Handle the error or rethrow it. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T12-effect-tracking.md",
      ignoredParam:
        "The .catch() handler does not use the error parameter '{{param}}'. Handle the error or rethrow it. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T12-effect-tracking.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"emptyCatch" | "ignoredParam", []>) {
    return {
      CallExpression(node) {
        const { callee, arguments: args } = node;
        if (callee.type !== "MemberExpression") return;
        if (callee.property.type !== "Identifier") return;
       if (callee.property.name !== "catch") return;

        const callback = args[0];
        if (!callback) return;
        if (
          callback.type !== "ArrowFunctionExpression" &&
          callback.type !== "FunctionExpression"
        )
          return;

        const errorParam = callback.params
          .filter((p): p is TSESTree.Identifier => p.type === "Identifier")
          .map((p) => p.name)[0];

        reportEatenErrorIfApplicable(callback, errorParam, context);
      },
    };
  },
});
