import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "no-function-type",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow using the built-in `Function` type, which loses parameter and return type information.",
    },
    messages: {
      noFunctionType:
        "Do not use the `Function` type. It accepts any callable and loses parameter and return type information. Use an explicit function type like `(args) => returnType` instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T45-paramspec-variadic.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"noFunctionType", []>) {
    return {
      TSTypeReference(node) {
        const { typeName } = node;
        if (
          typeName.type === "Identifier" &&
          typeName.name === "Function"
        ) {
          context.report({
            node,
            messageId: "noFunctionType",
          });
        }
      },
    };
  },
});
