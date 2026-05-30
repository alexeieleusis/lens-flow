import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "no-double-cast-any",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow double-cast through `any` (`value as any as T`) which bypasses all structural type checking",
    },
    messages: {
      doubleCastAny:
        "Double-cast through `any` bypasses structural type checking. Use a single `as` cast or a type guard instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T47-gradual-typing.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"doubleCastAny", []>) {
    return {
      TSAsExpression(node) {
        if (
          node.expression.type === "TSAsExpression" &&
          node.expression.typeAnnotation.type === "TSAnyKeyword"
        ) {
          context.report({ node, messageId: "doubleCastAny" });
        }
      },
    };
  },
});
