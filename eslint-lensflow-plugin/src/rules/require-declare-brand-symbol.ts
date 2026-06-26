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
    },
    schema: [],
    fixable: "code",
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"requireDeclareBrand", []>) {
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

          context.report({
            node: decl,
            messageId: "requireDeclareBrand",
            data: { name: varName },
            ...(isSingleDeclarator
              ? {
                  fix(fixer) {
                    const sourceCode = context.sourceCode;
                    const text = sourceCode.getText(node);
                    const isConst = text.startsWith("const");
                    if (!isConst) return null;

                    const replacement = `declare const ${varName}: unique symbol;`;
                    return fixer.replaceText(node, replacement);
                  },
                }
              : {}),
          });
        }
      },
    };
  },
});
