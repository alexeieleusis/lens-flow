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

function isConsoleLogging(node: TSESTree.Node): boolean {
  if (node.type !== "CallExpression") return false;
  const { callee } = node;
  if (callee.type !== "MemberExpression") return false;
  if (callee.object.type !== "Identifier" || callee.object.name !== "console")
    return false;
  if (callee.property.type !== "Identifier") return false;
  return callee.property.name === "error" || callee.property.name === "warn";
}

function reportEatenErrorIfApplicable(
  callback: TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression,
  errorParam: string | undefined,
  allowLogging: boolean,
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
    const usesErrorParam = errorParam && bodyIdentifiers.includes(errorParam);

    if (allowLogging && usesErrorParam && isConsoleLogging(callback.body))
      return;

    if (errorParam && !usesErrorParam) {
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
        "The .catch() handler has an empty body and silently swallows errors. Handle the error or rethrow it. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T12-effect-tracking.md",
      ignoredParam:
        "The .catch() handler does not use the error parameter '{{param}}'. Handle the error or rethrow it. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T12-effect-tracking.md",
    },
    schema: [
      {
        type: "object",
        properties: {
          allowLogging: {
            type: "boolean",
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
  },
  defaultOptions: [{ allowLogging: false }],
  create(context: TSESLint.RuleContext<"emptyCatch" | "ignoredParam", [{ allowLogging: boolean }]>) {
    const opts = context.options[0] as { allowLogging?: boolean } | undefined;
    const allowLogging = opts?.allowLogging ?? false;

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

        const paramNames = callback.params.map(
          (p) => (p.type === "Identifier" ? p.name : null),
        );
        const errorParam = paramNames.find((n) => n !== null);

        reportEatenErrorIfApplicable(
          callback,
          errorParam,
          allowLogging,
          context,
        );
      },
    };
  },
});
