import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

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

function isAstNode(val: unknown): val is TSESTree.Node {
  return typeof val === "object" && val !== null && "type" in val;
}

function pushChildNodes(
  node: TSESTree.Node,
  stack: TSESTree.Node[],
): void {
  for (const key of Object.keys(node)) {
    if (key === "parent" || key === "loc" || key === "range") continue;
    const val = (node as unknown as Record<string, unknown>)[key];
    if (!val || typeof val !== "object") continue;

    if (Array.isArray(val)) {
      for (const item of val) {
        if (isAstNode(item)) {
          stack.push(item);
        }
      }
    } else if (isAstNode(val)) {
      stack.push(val);
    }
  }
}

function findStringMatchInNode(
  root: TSESTree.Node,
  catchParamName: string,
): boolean {
  const visited = new WeakSet<TSESTree.Node>();
  const stack: TSESTree.Node[] = [root];

  while (stack.length > 0) {
    const node = stack.pop()!;
    if (visited.has(node)) continue;
    visited.add(node);

    if (
      node.type === "CallExpression" &&
      isStringMatchCall(node, catchParamName)
    ) {
      return true;
    }

    pushChildNodes(node, stack);
  }

  return false;
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
        "Do not match error types by string searching on error.message or error.name. Use typed discriminated unions with exhaustive switch instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/usecases/UC08-error-handling.md",
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

        if (findStringMatchInNode(catchBody, catchParamName)) {
          context.report({
            node,
            messageId: "stringMatchOnError",
          });
        }
      },
    };
  },
});
