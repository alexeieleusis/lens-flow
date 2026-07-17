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
        "Use `Record<K, V>` instead of `Partial<Record<K, V>>` to ensure exhaustiveness checking. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T31-record-types.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"noPartialRecord", []>) {
    return {
      TSTypeReference(node) {
        const typeName = node.typeName;
        const outerName =
          typeName.type === "Identifier"
            ? typeName.name
            : typeName.type === "TSQualifiedName"
              ? typeName.right.name
              : null;
        if (outerName === "Partial") {
          const params = node.typeArguments?.params;
          if (params && params.length >= 1) {
            const innerType = params[0];
            if (innerType.type === "TSTypeReference") {
              let innerName: string | null = null;
              if (innerType.typeName.type === "Identifier") {
                innerName = innerType.typeName.name;
              } else if (innerType.typeName.type === "TSQualifiedName") {
                innerName = innerType.typeName.right.name;
              }
              if (innerName === "Record") {
                context.report({
                  node,
                  messageId: "noPartialRecord",
                });
              }
            }
          }
        }
      },
    };
  },
});
