import { TSESTree, TSESLint } from '@typescript-eslint/utils';
import { createRule } from "../utils/rule-creator.js";

function hasJsonCall(node: TSESTree.Expression): boolean {
  if (
    node.type === "CallExpression" &&
    node.callee.type === "MemberExpression" &&
    !node.callee.computed &&
    node.callee.property.type === "Identifier" &&
    node.callee.property.name === "json"
  ) {
    return true;
  }

  if (
    node.type === "CallExpression" &&
    node.callee.type === "MemberExpression" &&
    !node.callee.computed &&
    node.callee.property.type === "Identifier" &&
    node.callee.property.name === "then" &&
    node.arguments.length > 0
  ) {
    const cb = node.arguments[0];
    if (cb.type === "ArrowFunctionExpression") {
      const body = cb.body;
      if (body.type === "BlockStatement") return false;
      return hasJsonCall(body);
    }
  }

  if (node.type === "AwaitExpression") {
    return hasJsonCall(node.argument);
  }

  return false;
}

export default createRule({
  name: "no-implicit-any-async-chain",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow untyped variables initialized from `.json()` in async chains",
    },
    messages: {
      implicitAnyAsyncChain:
        "Variable derived from `.json()` lacks an explicit type annotation, resulting in implicit `any`. Add a type annotation for null safety. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T13-null-safety.md",
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
