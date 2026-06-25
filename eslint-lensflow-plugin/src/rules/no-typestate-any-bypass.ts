import { AST_NODE_TYPES, TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

function isMethodChain(node: TSESTree.Node): boolean {
  if (node.type === AST_NODE_TYPES.ChainExpression) {
    return isMethodChain(node.expression);
  }
  if (node.type === AST_NODE_TYPES.TSNonNullExpression) {
    return isMethodChain(node.expression);
  }
  if (node.type === AST_NODE_TYPES.CallExpression) {
    return true;
  }
  if (
    node.type === AST_NODE_TYPES.MemberExpression &&
    isMethodChain(node.object)
  ) {
    return true;
  }
  return false;
}

export default createRule({
  name: "no-typestate-any-bypass",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow casting method-chain results to `any` which defeats typestate enforcement",
    },
    messages: {
      typestateBypass:
        "Casting a method-chain result to `any` defeats compile-time enforcement of required builder stages. Complete the typestate chain instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC09-builder-config.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"typestateBypass", []>) {
    return {
      TSAsExpression(node) {
        if (node.typeAnnotation.type !== AST_NODE_TYPES.TSAnyKeyword) {
          return;
        }

        if (isMethodChain(node.expression)) {
          context.report({
            node,
            messageId: "typestateBypass",
          });
        }
      },
    };
  },
});
