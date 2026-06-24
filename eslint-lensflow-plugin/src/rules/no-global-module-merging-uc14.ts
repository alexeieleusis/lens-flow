import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

const BUILTIN_INTERFACES = new Set(["Window", "Document", "NodeJS.Global", "NodeJS"]);

function resolveExprName(type: TSESTree.TSInterfaceHeritage): string | null {
  if (!type.expression) return null;
  const expr = type.expression;
  if (expr.type === "Identifier") return expr.name;
  const exprAny = expr as unknown as TSESTree.TSQualifiedName;
  if (exprAny.type === "TSQualifiedName") {
    const leftName = resolveExprName({ expression: exprAny.left as typeof expr, type: "TSInterfaceHeritage" } as unknown as TSESTree.TSInterfaceHeritage);
    const right = exprAny.right.name;
    return leftName ? `${leftName}.${right}` : right;
  }
  return null;
}

function isExtendingBuiltin(node: TSESTree.Statement): string | null {
  if (node.type !== "TSInterfaceDeclaration") return null;
  const extendsList = node.extends;
  if (!extendsList || extendsList.length === 0) return null;
  for (const ext of extendsList) {
    const name = resolveExprName(ext);
    if (name && BUILTIN_INTERFACES.has(name)) {
      return name;
    }
  }
  return null;
}

export default createRule({
  name: "no-global-module-merging-uc14",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `declare global` and module augmentations that pollute the global type namespace or extend built-in interfaces.",
    },
    messages: {
      globalNamespacePollution:
        "`declare global` pollutes the global type namespace across all modules. Scope augmentations to a specific module instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC14-extensibility.md",
      builtInInterfaceAugmentation:
        `Augmenting built-in interface "{{interface}}" in a module declaration pollutes the global namespace. Scope the augmentation more narrowly. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC14-extensibility.md`,
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"globalNamespacePollution" | "builtInInterfaceAugmentation", []>) {
    return {
      TSModuleDeclaration(node) {
        if (node.id.type === "Identifier" && node.id.name === "global") {
          context.report({
            node,
            messageId: "globalNamespacePollution",
          });
          return;
        }

        if (
          node.id.type === "Literal" &&
          typeof node.id.value === "string" &&
          node.body
        ) {
          const body = node.body as TSESTree.TSModuleBlock | TSESTree.TSModuleDeclaration;
          const bodyStatements =
            body.type === "TSModuleDeclaration"
              ? []
              : (body.body || []);

          for (const stmt of bodyStatements) {
            const builtinName = isExtendingBuiltin(stmt);
            if (builtinName) {
              context.report({
                node: stmt,
                messageId: "builtInInterfaceAugmentation",
                data: { interface: builtinName },
              });
              break;
            }
          }
        }
      },
    };
  },
});
