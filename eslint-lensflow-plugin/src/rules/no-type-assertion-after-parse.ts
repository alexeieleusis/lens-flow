import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

const KNOWLEDGE_URL =
  "https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T14-type-narrowing.md";

function isJsonParseCall(node: TSESTree.CallExpression): boolean {
  return (
    node.callee.type === "MemberExpression" &&
    node.callee.object.type === "Identifier" &&
    node.callee.object.name === "JSON" &&
    node.callee.property.type === "Identifier" &&
    node.callee.property.name === "parse"
  );
}

export default createRule({
  name: "no-type-assertion-after-parse",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow type assertions directly on JSON.parse results — use runtime validation instead",
    },
    messages: {
      directAssertion:
        "Do not use type assertion on JSON.parse result — use runtime validation instead. See: " +
        KNOWLEDGE_URL,
      indirectAssertion:
        "Do not use type assertion on a variable initialized from JSON.parse — use runtime validation instead. See: " +
        KNOWLEDGE_URL,
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"directAssertion" | "indirectAssertion", []>) {
    const jsonParseVars = new Set<string>();

    return {
      VariableDeclarator(node) {
        if (
          node.id.type === "Identifier" &&
          node.init?.type === "CallExpression" &&
          isJsonParseCall(node.init)
        ) {
          jsonParseVars.add(node.id.name);
        }
      },

      TSAsExpression(node) {
        const expr = node.expression;

        if (expr.type === "CallExpression" && isJsonParseCall(expr)) {
          context.report({
            node,
            messageId: "directAssertion",
          });
          return;
        }

        if (
          expr.type === "Identifier" &&
          jsonParseVars.has(expr.name)
        ) {
          context.report({
            node,
            messageId: "indirectAssertion",
          });
        }
      },
    };
  },
});
