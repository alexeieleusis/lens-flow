import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

export default createRule({
  name: "no-exposed-global-registry",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow module-level exported Map or Set that serve as global mutable registries",
    },
    messages: {
      exposedRegistry:
        "Exported {{collection}} instance '{{name}}' creates a global mutable registry. Encapsulate behind a controlled API instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/usecases/UC10-encapsulation.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"exposedRegistry", []>) {
    const mapSetDecls: Array<{
      node: TSESTree.VariableDeclaration;
      name: string;
      collection: string;
      directlyExported: boolean;
    }> = [];

    const exportedNames = new Set<string>();

    return {
      VariableDeclaration(node) {
        const isModuleLevel =
          node.parent?.type === "Program" ||
          (node.parent?.type === "ExportNamedDeclaration" &&
            node.parent.parent?.type === "Program");

        if (!isModuleLevel) return;

        const directlyExported = node.parent?.type === "ExportNamedDeclaration";

        for (const decl of node.declarations) {
          const init = decl.init;
          if (
            init?.type === "NewExpression" &&
            init.callee.type === "Identifier" &&
            (init.callee.name === "Map" || init.callee.name === "Set")
          ) {
            if (decl.id.type === "Identifier") {
              mapSetDecls.push({
                node,
                name: decl.id.name,
                collection: init.callee.name,
                directlyExported,
              });
            }
          }
        }
      },

      ExportNamedDeclaration(node) {
        if (node.parent?.type !== "Program") return;
        if (node.declaration) return;

        for (const spec of node.specifiers) {
          if (spec.local.type === "Identifier") {
            exportedNames.add(spec.local.name);
          }
        }
      },

      "Program:exit"() {
        for (const { node, name, collection, directlyExported } of mapSetDecls) {
          if (directlyExported || exportedNames.has(name)) {
            context.report({
              node,
              messageId: "exposedRegistry",
              data: { collection, name },
            });
          }
        }
      },
    };
  },
});
