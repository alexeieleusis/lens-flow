import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const KNOWLEDGE_URL = knowledgeUrl("catalog/T14-type-narrowing.md");

function isJsonParseCall(node: TSESTree.CallExpression): boolean {
  return (
    node.callee.type === "MemberExpression" &&
    node.callee.object.type === "Identifier" &&
    node.callee.object.name === "JSON" &&
    node.callee.property.type === "Identifier" &&
    node.callee.property.name === "parse"
  );
}

function unwrapExpression(node: TSESTree.Expression): TSESTree.Expression {
  let current: TSESTree.Expression = node;
  while (
    current.type === "TSNonNullExpression" ||
    current.type === "TSSatisfiesExpression" ||
    current.type === "TSAsExpression"
  ) {
    current = current.expression;
  }
  return current;
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
        "Do not use type assertion on JSON.parse result — use runtime validation instead. See: {{url}}",
      indirectAssertion:
        "Do not use type assertion on a variable initialized from JSON.parse — use runtime validation instead. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"directAssertion" | "indirectAssertion", []>) {
    function checkTypeNarrowing(
      node: TSESTree.TSAsExpression | TSESTree.TSSatisfiesExpression
    ) {
      const expr = unwrapExpression(node.expression);

      if (expr.type === "CallExpression" && isJsonParseCall(expr)) {
        context.report({
          node,
          messageId: "directAssertion",
          data: { url: KNOWLEDGE_URL },
        });
        return;
      }

      if (expr.type === "Identifier") {
        const scope = context.sourceCode.getScope(node);
        const variable = scope.variables.find(v => v.name === expr.name);
        const def = variable?.defs[0];
        const parent = def?.parent;
        if (
          def?.node?.type === "VariableDeclarator" &&
          parent?.type === "VariableDeclaration" &&
          parent?.kind === "const" &&
          def.node.init?.type === "CallExpression" &&
          isJsonParseCall(def.node.init)
        ) {
          context.report({
            node,
            messageId: "indirectAssertion",
            data: { url: KNOWLEDGE_URL },
          });
        }
      }
    }

    return {
      TSAsExpression(node) {
        checkTypeNarrowing(node);
      },
      TSSatisfiesExpression(node) {
        checkTypeNarrowing(node);
      },
    };
  },
});
