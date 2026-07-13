import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { walkNodes } from "../utils/ast-helpers.js";

function isAsConst(node: TSESTree.Node): boolean {
  return (
    node.type === "TSAsExpression" &&
    node.typeAnnotation.type === "TSTypeReference" &&
    node.typeAnnotation.typeName.type === "Identifier" &&
    node.typeAnnotation.typeName.name === "const"
  );
}

function isFunctionNode(node: TSESTree.Node): boolean {
  return (
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression" ||
    node.type === "ArrowFunctionExpression"
  );
}

function findAsConst(node: TSESTree.Node | null | undefined): TSESTree.Node | null {
  if (!node) return null;
  // The initializer itself may be a function (not wrapped in `as const`) —
  // its body belongs to the nested function, not this `let` binding.
  if (isFunctionNode(node)) return null;
  let result: TSESTree.Node | null = null;
  walkNodes(node, (n) => {
    if (isAsConst(n)) {
      result = n;
      return true;
    }
    return false;
  }, { stopAtFunctionBoundaries: true });
  return result;
}

export default createRule({
  name: "no-as-const-on-let",
  meta: {
    type: "problem",
    docs: {
      description: "Disallow `as const` on `let` bindings, as the narrowed type is lost on reassignment",
    },
    messages: {
      asConstOnLet: "`as const` on a `let` binding is pointless — the literal type is lost on any reassignment. Use `const` instead, or a regular `let` with an explicit type. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T32-immutability-markers.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"asConstOnLet", []>) {
    return {
      VariableDeclaration(node) {
        if (node.kind !== "let") return;

        for (const decl of node.declarations) {
          const asConst = findAsConst(decl.init);
          if (asConst) {
            context.report({
              node: asConst,
              messageId: "asConstOnLet",
            });
          }
        }
      },
    };
  },
});
