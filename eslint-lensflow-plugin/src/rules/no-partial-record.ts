import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "no-partial-record",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `Partial<Record<K, V>>` which bypasses exhaustiveness checking",
    },
    messages: {
      noPartialRecord:
        "Use `Record<K, V>` instead of `Partial<Record<K, V>>` to ensure exhaustiveness checking. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T31-record-types.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"noPartialRecord", []>) {
    return {
      TSTypeReference(node) {
        const typeName = node.typeName;
        if (
          typeName.type === "Identifier" &&
          typeName.name === "Partial"
        ) {
          const params = node.typeArguments?.params;
          if (params && params.length >= 1) {
            const innerType = params[0];
            if (
              innerType.type === "TSTypeReference" &&
              innerType.typeName.type === "Identifier" &&
              innerType.typeName.name === "Record"
            ) {
              context.report({
                node,
                messageId: "noPartialRecord",
              });
            }
          }
        }
      },
    };
  },
});
