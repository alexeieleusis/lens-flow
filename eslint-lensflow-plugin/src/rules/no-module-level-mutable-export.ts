import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "no-module-level-mutable-export",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow module-level mutable exports (export let/var) that create globally reachable state.",
    },
    messages: {
      mutableExport:
        "Mutable export '{{kind}} {{name}}' creates globally reachable state. Use a class or const with private internals instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T21-encapsulation.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"mutableExport", []>) {
    return {
      ExportNamedDeclaration(node) {
        if (
          node.declaration?.type === "VariableDeclaration" &&
          (node.declaration.kind === "let" || node.declaration.kind === "var")
        ) {
          const decl = node.declaration;
          const name =
            decl.declarations.length > 0 &&
            decl.declarations[0].id.type === "Identifier"
              ? decl.declarations[0].id.name
              : "(unnamed)";
          context.report({
            node,
            messageId: "mutableExport",
            data: {
              kind: decl.kind,
              name,
            },
          });
        }
      },
    };
  },
});
