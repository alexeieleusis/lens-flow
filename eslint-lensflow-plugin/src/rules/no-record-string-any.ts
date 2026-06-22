import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "no-record-string-any",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `Record<K, any>` which loses all value type safety",
    },
    messages: {
      recordAny:
        "`Record<K, any>` loses value type safety. Use `Record<K, unknown>` and narrow with type guards. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T47-gradual-typing.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"recordAny", []>) {
    return {
      TSTypeReference(node) {
        const typeName = node.typeName;
        let name: string | null = null;
        if (typeName.type === "Identifier") {
          name = typeName.name;
        } else if (typeName.type === "TSQualifiedName") {
          name = typeName.right.name;
        }
        if (!name) return;

        if (name !== "Record") return;

        const params = node.typeArguments?.params;
        if (
          params?.length === 2 &&
          params[1].type === "TSAnyKeyword"
        ) {
          context.report({
            node,
            messageId: "recordAny",
          });
        }
      },
    };
  },
});
