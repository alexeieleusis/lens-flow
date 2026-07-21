import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T33-self-type.md");

function isThisConstructorName(node: TSESTree.Node): boolean {
  if (node.type !== "MemberExpression") return false;
  if (node.property.type !== "Identifier" || node.property.name !== "name")
    return false;
  const obj = node.object;
  if (obj.type !== "MemberExpression") return false;
  if (obj.property.type !== "Identifier" || obj.property.name !== "constructor")
    return false;
  if (obj.object.type !== "ThisExpression") return false;
  return true;
}

export default createRule({
  name: "prefer-instanceof-over-constructor-name",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `this.constructor.name` comparisons in favor of `instanceof`",
    },
    messages: {
      preferInstanceof:
        'Use `this instanceof {{className}}` instead of `this.constructor.name === "{{className}}"`. The constructor name is fragile across bundlers and minifiers. See: {{url}}',
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"preferInstanceof", []>) {
    return {
      BinaryExpression(node) {
        if (!["==", "===", "!=", "!=="].includes(node.operator)) return;

        const leftIsPattern = isThisConstructorName(node.left);
        const rightIsPattern = isThisConstructorName(node.right);

        if (!leftIsPattern && !rightIsPattern) return;

        const stringLit = leftIsPattern ? node.right : node.left;
        if (stringLit.type !== "Literal" || typeof stringLit.value !== "string")
          return;

        context.report({
          node,
          messageId: "preferInstanceof",
          data: {
            className: stringLit.value,
            url: URL,
          },
        });
      },
    };
  },
});
