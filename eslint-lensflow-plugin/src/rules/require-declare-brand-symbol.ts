import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

const URL = knowledgeUrl("catalog/T03-newtypes-opaque.md");

const checkDeclarator = (
  decl: TSESTree.VariableDeclarator,
  node: TSESTree.VariableDeclaration,
  context: TSESLint.RuleContext<"requireDeclareBrand" | "symbolTypedBrand", []>,
) => {
  if (decl.init?.type !== "CallExpression") return false;

  const callee = decl.init.callee;
  if (callee.type !== "Identifier" || callee.name !== "Symbol") return false;

  const varName = decl.id.type === "Identifier" ? decl.id.name : null;
  if (!varName) return false;

  const hasSymbolType =
    decl.id.typeAnnotation?.typeAnnotation.type === "TSSymbolKeyword";
  const matchesBrandNaming =
    varName.startsWith("__") || varName.endsWith("Brand");

  if (!hasSymbolType && !matchesBrandNaming) return false;

  if (matchesBrandNaming) {
    const isConst = context.sourceCode.getText(node).startsWith("const");
    if (!isConst) return false;

    const isSingleDeclarator = node.declarations.length === 1;
    context.report({
      node: decl,
      messageId: "requireDeclareBrand",
      data: { name: varName, url: URL },
      ...(isSingleDeclarator
        ? {
            fix(fixer) {
              return fixer.replaceText(
                node,
                `declare const ${varName}: unique symbol;`,
              );
            },
          }
        : {}),
    });
    return true;
  }

  if (hasSymbolType) {
    context.report({
      node: decl,
      messageId: "symbolTypedBrand",
      data: { name: varName, url: URL },
    });
  }
  return false;
};

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
        "Brand symbol {{name}} uses `const` which emits a runtime value. Use `declare const {{name}}: unique symbol;` instead. See: {{url}}",
      symbolTypedBrand:
        "Symbol {{name}} is typed as `symbol` and uses `const` which emits a runtime value. Consider using `declare const {{name}}: symbol;` if the symbol is not a brand, or rename to match brand conventions (e.g., `__{{name}}Brand`) for auto-fix. See: {{url}}",
    },
    schema: [],
    fixable: "code",
  },
  defaultOptions: [],
  create(
    context: TSESLint.RuleContext<
      "requireDeclareBrand" | "symbolTypedBrand",
      []
    >,
  ) {
    return {
      VariableDeclaration(node) {
        if (node.declare || node.declarations.length === 0) return;

        for (const decl of node.declarations) {
          if (checkDeclarator(decl, node, context)) return;
        }
      },
    };
  },
});
