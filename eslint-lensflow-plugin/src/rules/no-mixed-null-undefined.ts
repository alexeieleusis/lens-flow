import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "no-mixed-null-undefined",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow union types that include both null and undefined members",
    },
    messages: {
      mixedNullUndefined:
        "Union type mixes both null and undefined. Pick one based on intent: null for explicit absence, undefined for not-yet-provided. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T13-null-safety.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"mixedNullUndefined", []>) {
    return {
      TSUnionType(node) {
        const members = node.types;
        const hasNull = members.some(
          (member) => member.type === "TSNullKeyword",
        );
        const hasUndefined = members.some(
          (member) => member.type === "TSUndefinedKeyword",
        );
        if (hasNull && hasUndefined) {
          context.report({
            node,
            messageId: "mixedNullUndefined",
          });
        }
      },
    };
  },
});
