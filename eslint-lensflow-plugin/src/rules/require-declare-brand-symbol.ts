import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "require-declare-brand-symbol",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require `declare const` for brand symbols instead of `const` to avoid emitting runtime values.",
    },
    messages: {
      requireDeclareBrand:
        "Brand symbol {{name}} uses `const` which emits a runtime value. Use `declare const {{name}}: unique symbol;` instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T03-newtypes-opaque.md",
      symbolTypedBrand:
        "Symbol {{name}} is typed as `symbol` and uses `const` which emits a runtime value. Consider using `declare const {{name}}: symbol;` if the symbol is not a brand, or rename to match brand conventions (e.g., `__{{name}}Brand`) for auto-fix. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T03-newtypes-opaque.md",
    },
    schema: [],
    fixable: "code",
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"requireDeclareBrand" | "symbolTypedBrand", []>) {
    return {
      VariableDeclaration(node) {
        if (node.declare) return;
        if (node.declarations.length === 0) return;

        const isSingleDeclarator = node.declarations.length === 1;

        for (const decl of node.declarations) {
          if (!decl.init) continue;
          if (decl.init.type !== "CallExpression") continue;

          const callee = decl.init.callee;
          if (callee.type !== "Identifier" || callee.name !== "Symbol") continue;

          const varName =
            decl.id.type === "Identifier" ? decl.id.name : null;
          if (!varName) continue;

          const hasSymbolType =
            decl.id.typeAnnotation?.typeAnnotation.type === "TSSymbolKeyword";
          const matchesBrandNaming =
            varName.startsWith("__") || varName.endsWith("Brand");

          if (!hasSymbolType && !matchesBrandNaming) continue;

          // `declare` only works with `const`, skip non-const declarations
          const sourceCode = context.sourceCode;
          const text = sourceCode.getText(node);
          const isConst = text.startsWith("const");
          if (!isConst && matchesBrandNaming) continue;

          if (matchesBrandNaming) {
            context.report({
              node: decl,
              messageId: "requireDeclareBrand",
              data: { name: varName },
              ...(isSingleDeclarator
              ? {
                  fix(fixer) {
                    const replacement = `declare const ${varName}: unique symbol;`;
                    return fixer.replaceText(node, replacement);
                  },
                }
              : {}),
            });
            return;
          }

          if (hasSymbolType) {
            context.report({
              node: decl,
              messageId: "symbolTypedBrand",
              data: { name: varName },
            });
          }
        }
      },
    };
  },
});
