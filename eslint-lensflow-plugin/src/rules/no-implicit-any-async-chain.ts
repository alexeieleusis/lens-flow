import { TSESTree, TSESLint } from '@typescript-eslint/utils';
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T13-null-safety.md");

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

function isDirectJsonCall(node: TSESTree.Expression): boolean {
  return (
    node.type === "CallExpression" &&
    node.callee.type === "MemberExpression" &&
    !node.callee.computed &&
    node.callee.property.type === "Identifier" &&
    node.callee.property.name === "json"
  );
}

function hasJsonCall(node: TSESTree.Expression): boolean {
  if (isDirectJsonCall(node)) {
    const callee = (node as TSESTree.CallExpression).callee as TSESTree.MemberExpression;
    return isFetchLike(callee.object);
  }

  if (
    node.type === "CallExpression" &&
    node.callee.type === "MemberExpression" &&
    !node.callee.computed &&
    node.callee.property.type === "Identifier" &&
    node.callee.property.name === "then" &&
    node.arguments.length > 0
  ) {
    // Once a `.json()` call taints the chain, later `.then()`s stay untyped `any`.
    if (hasJsonCall(node.callee.object)) return true;
    if (!isFetchLike(node.callee.object)) return false;

    const cb = node.arguments[0];
    if (cb.type !== "SpreadElement") {
      const result = checkThenCallback(cb);
      if (result !== undefined) return result;
    }
    return false;
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
    // Body is the resolved-value expression itself (e.g. `r` in `r => r.json()`),
    // not a fetch() call, so check for `.json()` directly without the fetch-like gate.
    return isDirectJsonCall(body);
  }

  // FunctionExpression callbacks are deliberately not inspected — see valid test case.
  if (cb.type === "FunctionExpression") {
    return false;
  }

  return undefined;
}

export default createRule({
  name: "no-implicit-any-async-chain",
  meta: {
    fixable: undefined,
    type: "problem",
    docs: {
      description:
        "Disallow untyped variables from `.json()` on fetch chains. Detects `.json()` on `fetch()` calls and awaited expressions. Does not flag `.json()` on arbitrary objects like `config.json()` or `cache.json()`. Note: Response-typed variables not directly tied to `fetch()` are not detected — annotate them manually for null safety.",
    },
    messages: {
      implicitAnyAsyncChain:
        "Variable from `.json()` on a fetch chain lacks an explicit type annotation, resulting in implicit `any`. Add a type annotation for null safety. See: {{url}}",
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
            data: {
              url: URL,
            },
          });
        }
      },
    };
  },
});
