import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESLint } from "@typescript-eslint/utils";

const URL = knowledgeUrl("catalog/T03-newtypes-opaque.md");

function isBrandSymbolName(name: string): boolean {
  // Matches common branding conventions:
  // - ends with "_brand" (e.g., MyType_brand)
  // - contains "$$" (e.g., $$type, $$MyBrand)
  // - underscore-prefixed (e.g., _brand, _type, _key)
  return /\$[$]/.test(name) || /\b_brand$/.test(name) || name.startsWith('_');
}

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
        "Exporting the brand symbol \"{{name}}\" allows callers to forge branded values, bypassing smart constructor validation. Use `declare const` instead of `export const`. See: {{url}}",
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

        for (const decl of node.declarations) {
          if (
            decl.init?.type === "CallExpression" &&
            ((decl.init.callee.type === "Identifier" &&
              decl.init.callee.name === "Symbol") ||
              (decl.init.callee.type === "MemberExpression" &&
                decl.init.callee.object.type === "Identifier" &&
                decl.init.callee.object.name === "Symbol" &&
                decl.init.callee.property.type === "Identifier" &&
                decl.init.callee.property.name === "for"))
          ) {
            const name =
              decl.id.type === "Identifier" ? decl.id.name : "<unknown>";
            if (!name || !isBrandSymbolName(name)) continue;

            context.report({
              node: decl,
              messageId: "exportedBrandSymbol",
              data: { name, url: URL },
            });
          }
        }
      },
    };
  },
});
