import { createRule } from "../utils/rule-creator.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

function getLastName(typeName: TSESTree.EntityName): string {
  if (typeName.type === "Identifier") return typeName.name;
  if (typeName.type === "TSQualifiedName") return getLastName(typeName.right);
  return "";
}

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
        if (getLastName(node.typeName) !== "Partial") return;

        const params = node.typeArguments?.params;
        if (!params || params.length < 1) return;

        const innerType = params[0];
        if (innerType.type !== "TSTypeReference") return;
        if (getLastName(innerType.typeName) !== "Record") return;

        context.report({
          node,
          messageId: "noPartialRecord",
        });
      },
    };
  },
});
