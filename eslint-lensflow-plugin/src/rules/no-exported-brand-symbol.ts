import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "no-exported-brand-symbol",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow exporting brand symbol constants, which allows callers to forge branded values.",
    },
    messages: {
      exportedBrandSymbol:
        "Exporting the brand symbol \"{{name}}\" allows callers to forge branded values, bypassing smart constructor validation. Use `declare const` instead of `export const`. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T03-newtypes-opaque.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"exportedBrandSymbol", []>) {
    return {
      VariableDeclaration(node) {
        if (node.declare) return;

        const parent = node.parent;
        if (parent?.type !== "ExportNamedDeclaration") return;

        const hasSymbolInit = node.declarations.some(
          (decl) =>
            decl.init?.type === "CallExpression" &&
            decl.init.callee.type === "Identifier" &&
            decl.init.callee.name === "Symbol",
        );
        if (!hasSymbolInit) return;

        const name =
          node.declarations[0]?.id.type === "Identifier"
            ? node.declarations[0].id.name
            : "<unknown>";

        context.report({
          node,
          messageId: "exportedBrandSymbol",
          data: { name },
        });
      },
    };
  },
});
