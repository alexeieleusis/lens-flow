import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "no-unnecessary-template-literal-type",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow template literal types that wrap a string literal union without any interpolation",
    },
    messages: {
      unnecessaryTemplateLiteral:
        "This template literal type produces the same type as its inner expression. Replace with the inner type directly. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T63-template-literal-types.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"unnecessaryTemplateLiteral", []>) {
    return {
      TSTemplateLiteralType(node) {
        if (node.quasis.length !== 2) return;
        if (node.quasis.some((q) => q.value.cooked !== "")) return;
        if (node.types.length !== 1) return;

        const innerType = node.types[0];
        const targetType =
          innerType.type === "TSUnionType"
            ? innerType.types
            : [innerType];

        if (
          targetType.length === 0 ||
          !targetType.every(
            (t) =>
              t.type === "TSLiteralType" &&
              (t as any).literal.type === "Literal" &&
              typeof (t as any).literal.value === "string",
          )
        )
          return;

        context.report({
          node,
          messageId: "unnecessaryTemplateLiteral",
        });
      },
    };
  },
});
