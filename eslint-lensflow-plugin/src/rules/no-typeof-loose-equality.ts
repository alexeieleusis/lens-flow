import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESLint } from "@typescript-eslint/utils";

const URL = knowledgeUrl("catalog/T14-type-narrowing.md");

export default createRule({
  name: "no-typeof-loose-equality",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow loose equality (== or !=) with typeof checks, which prevents TypeScript from narrowing the type",
    },
    messages: {
      looseTypeofEq:
        "Use '===' instead of '==' with typeof for proper type narrowing. See: {{url}}",
      looseTypeofNeq:
        "Use '!==' instead of '!=' with typeof for proper type narrowing. See: {{url}}",
    },
    schema: [],
    fixable: "code",
  },
  defaultOptions: [],
  create(
    context: TSESLint.RuleContext<"looseTypeofEq" | "looseTypeofNeq", []>,
  ) {
    return {
      BinaryExpression(node) {
        if (node.operator !== "==" && node.operator !== "!=") return;

        const hasTypeof =
          (node.left.type === "UnaryExpression" &&
            node.left.operator === "typeof") ||
          (node.right.type === "UnaryExpression" &&
            node.right.operator === "typeof");

        if (!hasTypeof) return;

        context.report({
          node,
          messageId:
            node.operator === "==" ? "looseTypeofEq" : "looseTypeofNeq",
          data: { url: URL },
          fix: (fixer) => {
            const sourceCode = context.sourceCode;
            const opToken = sourceCode.getTokenBefore(node.right)!;
            return fixer.replaceText(
              opToken,
              node.operator === "==" ? "===" : "!==",
            );
          },
        });
      },
    };
  },
});
