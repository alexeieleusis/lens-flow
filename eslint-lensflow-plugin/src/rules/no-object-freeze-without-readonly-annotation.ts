import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

function getTypeNameIdentifier(node: TSESTree.Node | undefined): string | null {
  if (!node) return null;
  if (node.type === AST_NODE_TYPES.Identifier) return node.name;
  if (node.type === AST_NODE_TYPES.TSQualifiedName) return getTypeNameIdentifier(node.right);
  return null;
}

function hasAsConst(declarator: TSESTree.VariableDeclarator): boolean {
  const init = declarator.init;
  if (!init) return false;
  if (
    init.type === AST_NODE_TYPES.TSAsExpression &&
    init.typeAnnotation.type === AST_NODE_TYPES.TSTypeReference &&
    getTypeNameIdentifier(init.typeAnnotation.typeName) === "const"
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
      getTypeNameIdentifier(ann.typeAnnotation.typeName) === "Readonly"
    ) {
      return true;
    }
  }
  if (declarator.init) {
    const init = declarator.init;
    if (
      init.type === AST_NODE_TYPES.TSAsExpression &&
      init.typeAnnotation?.type === AST_NODE_TYPES.TSTypeReference &&
      getTypeNameIdentifier(init.typeAnnotation.typeName) === "Readonly"
    ) {
      return true;
    }
  }
  return false;
}

function isObjectFreezeCall(node: TSESTree.CallExpression): boolean {
  const callee = node.callee;
  return (
    callee.type === AST_NODE_TYPES.MemberExpression &&
    callee.object?.type === AST_NODE_TYPES.Identifier &&
    callee.object.name === "Object" &&
    callee.property?.type === AST_NODE_TYPES.Identifier &&
    callee.property.name === "freeze"
  );
}

function isDirectInit(declarator: TSESTree.VariableDeclarator, target: TSESTree.Node): boolean {
  if (!declarator.init) return false;
  let unwrapped = declarator.init;
  while (
    unwrapped.type === AST_NODE_TYPES.TSAsExpression ||
    unwrapped.type === AST_NODE_TYPES.TSNonNullExpression ||
    unwrapped.type === AST_NODE_TYPES.TSSatisfiesExpression
  ) {
    unwrapped = unwrapped.expression;
  }
  return unwrapped === target;
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
        "Object.freeze() provides runtime immutability but TypeScript does not infer readonly from it. Add `as const` or a `Readonly<T>` type annotation. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T32-immutability-markers.md",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"missingReadonly", []>) {
    function findDirectDeclarator(node: TSESTree.Node): TSESTree.VariableDeclarator | null {
      const ancestors = context.sourceCode.getAncestors(node);
      for (const ancestor of ancestors) {
        if (ancestor.type === AST_NODE_TYPES.VariableDeclarator) return ancestor;
      }
      return null;
    }

    function isPerAncestor(ancestor: TSESTree.Node): boolean {
      return (
        ancestor.type === AST_NODE_TYPES.Property ||
        ancestor.type === AST_NODE_TYPES.ArrayExpression
      );
    }

    function isFunctionAncestor(ancestor: TSESTree.Node): boolean {
      return (
        ancestor.type === AST_NODE_TYPES.FunctionDeclaration ||
        ancestor.type === AST_NODE_TYPES.FunctionExpression ||
        ancestor.type === AST_NODE_TYPES.ArrowFunctionExpression
      );
    }

    function handleIndirectInit(declarator: TSESTree.VariableDeclarator, node: TSESTree.CallExpression): void {
      const ancestors = context.sourceCode.getAncestors(node);
      for (let i = ancestors.length - 1; i >= 0; i--) {
        const ancestor = ancestors[i];
        if (ancestor === declarator) break;
        if (isPerAncestor(ancestor)) return;
        if (isFunctionAncestor(ancestor)) {
          context.report({ node, messageId: "missingReadonly" });
          return;
        }
      }
      if (hasAsConst(declarator) || hasReadonlyAnnotation(declarator)) return;
      context.report({ node, messageId: "missingReadonly" });
    }

    return {
      CallExpression(node) {
        if (!isObjectFreezeCall(node)) return;

        const declarator = findDirectDeclarator(node);
        if (!declarator) return;

        if (isDirectInit(declarator, node)) {
          if (hasAsConst(declarator) || hasReadonlyAnnotation(declarator)) return;
          context.report({ node, messageId: "missingReadonly" });
        } else {
          handleIndirectInit(declarator, node);
        }
      },
    };
  },
});
