import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

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
        "Use '===' instead of '==' with typeof for proper type narrowing. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T14-type-narrowing.md",
      looseTypeofNeq:
        "Use '!==' instead of '!=' with typeof for proper type narrowing. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T14-type-narrowing.md",
    },
    schema: [],
    fixable: "code",
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"looseTypeofEq" | "looseTypeofNeq", []>) {
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
