import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

function isAsConst(node: TSESTree.Node): boolean {
  if (
    node.type === "TSAsExpression" &&
    node.typeAnnotation.type === "TSTypeReference" &&
    (node.typeAnnotation.typeName as TSESTree.Identifier).name === "const"
  ) {
    return true;
  }
  return false;
}

function findAsConst(node: TSESTree.Node | null | undefined): TSESTree.Node | null {
  if (!node) return null;

  if (isAsConst(node)) return node;

  const seen = new WeakSet<object>();

  function walkChild(value: unknown): TSESTree.Node | null {
    if (!value || typeof value !== "object") return null;
    if ("type" in value) {
      return walk(value as TSESTree.Node);
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = walkChild(item);
        if (found) return found;
      }
    }
    return null;
  }

  function walk(current: TSESTree.Node): TSESTree.Node | null {
    if (isAsConst(current)) return current;
    if (seen.has(current)) return null;
    seen.add(current);
    for (const [, value] of Object.entries(current)) {
      const found = walkChild(value);
      if (found) return found;
    }
    return null;
  }

  return walk(node);
}

export default createRule({
  name: "no-as-const-on-let",
  meta: {
    type: "problem",
    docs: {
      description: "Disallow `as const` on `let` bindings, as the narrowed type is lost on reassignment",
    },
    messages: {
      asConstOnLet: "`as const` on a `let` binding is pointless — the literal type is lost on any reassignment. Use `const` instead, or a regular `let` with an explicit type. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T32-immutability-markers.md",
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
