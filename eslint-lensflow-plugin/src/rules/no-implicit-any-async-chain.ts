import { TSESTree, TSESLint } from '@typescript-eslint/utils';
import { createRule } from "../utils/rule-creator.js";

function isFetchLike(node: TSESTree.Expression): boolean {
  if (
    node.type === "CallExpression" &&
    node.callee.type === "Identifier" &&
    node.callee.name === "fetch"
  ) {
    return true;
  }
  return false;
}

function hasJsonCall(node: TSESTree.Expression): boolean {
  if (
    node.type === "CallExpression" &&
    node.callee.type === "MemberExpression" &&
    !node.callee.computed &&
    node.callee.property.type === "Identifier" &&
    node.callee.property.name === "json"
  ) {
    return isFetchLike(node.callee.object);
  }

  if (
    node.type === "CallExpression" &&
    node.callee.type === "MemberExpression" &&
    !node.callee.computed &&
    node.callee.property.type === "Identifier" &&
    node.callee.property.name === "then" &&
    node.arguments.length > 0
  ) {
    if (!isFetchLike(node.callee.object)) return false;
    const cb = node.arguments[0];
    const result = checkThenCallback(cb);
    if (result !== undefined) return result;
  }

  if (node.type === "AwaitExpression") {
    return hasJsonCall(node.argument);
  }

  return false;
}

function checkThenCallback(
  cb: TSESTree.Expression
): boolean | undefined {
  if (cb.type === "ArrowFunctionExpression") {
    const body = cb.body;
    if (body.type === "BlockStatement") return false;
    return hasJsonCall(body);
  }

  if (cb.type === "FunctionExpression") {
    for (const stmt of cb.body.body) {
      if (stmt.type === "ReturnStatement" && stmt.argument) {
        return hasJsonCall(stmt.argument);
      }
    }
    return false;
  }

  return undefined;
}

export default createRule({
  name: "no-implicit-any-async-chain",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow untyped variables from `.json()` on fetch chains. Detects `.json()` on `fetch()` calls and awaited expressions. Does not flag `.json()` on arbitrary objects like `config.json()` or `cache.json()`. Note: Response-typed variables not directly tied to `fetch()` are not detected — annotate them manually for null safety.",
    },
    messages: {
      implicitAnyAsyncChain:
        "Variable from `.json()` on a fetch chain lacks an explicit type annotation, resulting in implicit `any`. Add a type annotation for null safety. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T13-null-safety.md",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"implicitAnyAsyncChain", []>) {
    return {
      VariableDeclarator(node) {
        if (node.id.typeAnnotation) return;
        if (!node.init) return;

        if (hasJsonCall(node.init)) {
          context.report({
            node,
            messageId: "implicitAnyAsyncChain",
          });
        }
      },
    };
  },
});
