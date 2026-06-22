import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

function hasAsConst(declarator: TSESTree.VariableDeclarator): boolean {
  const init = declarator.init;
  if (!init) return false;
  if (
    init.type === AST_NODE_TYPES.TSAsExpression &&
    init.typeAnnotation.type === AST_NODE_TYPES.TSTypeReference &&
    init.typeAnnotation.typeName?.type === AST_NODE_TYPES.Identifier &&
    init.typeAnnotation.typeName.name === "const"
  ) {
    return true;
  }
  return false;
}

function hasReadonlyAnnotation(declarator: TSESTree.VariableDeclarator): boolean {
  if (declarator.id?.typeAnnotation) {
    const ann = declarator.id.typeAnnotation;
    if (
      ann.typeAnnotation?.type === AST_NODE_TYPES.TSTypeReference &&
      ann.typeAnnotation.typeName?.type === AST_NODE_TYPES.Identifier &&
      ann.typeAnnotation.typeName.name === "Readonly"
    ) {
      return true;
    }
  }
  if (declarator.init) {
    const init = declarator.init;
    if (
      init.type === AST_NODE_TYPES.TSAsExpression &&
      init.typeAnnotation?.type === AST_NODE_TYPES.TSTypeReference &&
      init.typeAnnotation.typeName?.type === AST_NODE_TYPES.Identifier &&
      init.typeAnnotation.typeName.name === "Readonly"
    ) {
      return true;
    }
  }
  return false;
}

export default createRule({
  name: "no-object-freeze-without-readonly-annotation",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow Object.freeze() without Readonly<T> type annotation or as const",
    },
    messages: {
      missingReadonly:
        "Object.freeze() provides runtime immutability but TypeScript does not infer readonly from it. Add `as const` or a `Readonly<T>` type annotation. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T32-immutability-markers.md",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"missingReadonly", []>) {
    function findVariableDeclarator(node: TSESTree.Node): TSESTree.VariableDeclarator | null {
      return context.sourceCode.getAncestors(node)
        .find((a): a is TSESTree.VariableDeclarator => a.type === AST_NODE_TYPES.VariableDeclarator) ?? null;
    }

    return {
      CallExpression(node) {
        const callee = node.callee;
        if (
          callee.type !== AST_NODE_TYPES.MemberExpression ||
          callee.object?.type !== AST_NODE_TYPES.Identifier ||
          callee.object.name !== "Object" ||
          callee.property?.type !== AST_NODE_TYPES.Identifier ||
          callee.property.name !== "freeze"
        ) {
          return;
        }

        const declarator = findVariableDeclarator(node);
        if (!declarator) return;

        if (hasAsConst(declarator) || hasReadonlyAnnotation(declarator)) return;

        context.report({
          node,
          messageId: "missingReadonly",
        });
      },
    };
  },
});
