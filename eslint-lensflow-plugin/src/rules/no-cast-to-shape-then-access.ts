import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "no-cast-to-shape-then-access",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow casting to an inline shape then immediately accessing a property, which suggests using a generic constraint instead.",
    },
    messages: {
      castToShapeThenAccess:
        "Casting to an inline shape `as { ... }` then accessing a property indicates a missing generic constraint. Use `T extends { ... }` on the function instead. See: https://github.com/jpablo/vibe-types/blob/main/plugin/skills/typescript/usecases/UC04-generic-constraints.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"castToShapeThenAccess", []>) {
    return {
      MemberExpression(node) {
        if (
          node.object.type === "TSAsExpression" &&
          node.object.typeAnnotation.type === "TSTypeLiteral"
        ) {
          context.report({
            node: node.object,
            messageId: "castToShapeThenAccess",
          });
        }
      },
    };
  },
});
