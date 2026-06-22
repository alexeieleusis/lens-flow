import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "prefer-property-function-signature",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer property function syntax (`foo: () => void`) over method syntax (`foo(): void`) in interfaces to ensure proper contravariance under --strictFunctionTypes",
    },
    messages: {
      preferPropertyFunction:
        "Interface method '{{name}}' uses method signature syntax which is bivariant under --strictFunctionTypes. Use property function syntax (`{{name}}: (...) => ...`) instead to enforce contravariant parameter checking. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T36-trait-objects.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"preferPropertyFunction", []>) {
    return {
      TSMethodSignature(node) {
        if (node.parent?.type !== "TSInterfaceBody") return;

        let methodName: string;
        if (node.key.type === "Identifier") {
          methodName = node.key.name;
        } else if (node.key.type === "Literal" && typeof node.key.value === "string") {
          methodName = node.key.value;
        } else {
          methodName = "<unknown>";
        }

        context.report({
          node,
          messageId: "preferPropertyFunction",
          data: { name: methodName },
        });
      },
    };
  },
});
