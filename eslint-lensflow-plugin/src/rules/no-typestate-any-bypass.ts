import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("usecases/UC09-builder-config.md");

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
        "Casting a method-chain result to `any` defeats compile-time enforcement of required builder stages. Complete the typestate chain instead. See: {{url}}",
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
            data: { url: URL },
          });
        }
      },
    };
  },
});
