import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("usecases/UC10-encapsulation.md");

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
        "Exported {{collection}} instance '{{name}}' creates a global mutable registry. Encapsulate behind a controlled API instead. See: {{url}}",
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
        const ancestors = context.sourceCode.getAncestors(node);
        const isModuleLevel =
          ancestors.length === 1 ||
          (ancestors[ancestors.length - 1].type === "ExportNamedDeclaration" &&
            ancestors.length === 2);

        if (!isModuleLevel) return;

        const directlyExported =
          ancestors[ancestors.length - 1].type === "ExportNamedDeclaration";

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
        const ancestors = context.sourceCode.getAncestors(node);
        if (ancestors.length !== 1 || ancestors[0].type !== "Program") return;
        if (node.declaration) return;

        for (const spec of node.specifiers) {
          if (spec.local.type === "Identifier") {
            exportedNames.add(spec.local.name);
          }
        }
      },

      ExportDefaultDeclaration(node) {
        const ancestors = context.sourceCode.getAncestors(node);
        if (ancestors.length !== 1 || ancestors[0].type !== "Program") return;

        const decl = node.declaration;

        // Case 1: `export default new Map()` or `export default new Set()`
        if (
          decl?.type === "NewExpression" &&
          decl.callee.type === "Identifier" &&
          (decl.callee.name === "Map" || decl.callee.name === "Set")
        ) {
          context.report({
            node: decl,
            messageId: "exposedRegistry",
            data: {
              collection: decl.callee.name,
              name: "<anonymous>",
              url: URL,
            },
          });
          return;
        }

        // Case 2: `const m = new Map(); export default m;`
        if (decl?.type === "Identifier") {
          exportedNames.add(decl.name);
        }
      },

      "Program:exit"() {
        for (const {
          node,
          name,
          collection,
          directlyExported,
        } of mapSetDecls) {
          if (directlyExported || exportedNames.has(name)) {
            context.report({
              node,
              messageId: "exposedRegistry",
              data: { collection, name, url: URL },
            });
          }
        }
      },
    };
  },
});
