import { AST_NODE_TYPES, TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

type FunctionNode =
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression
  | TSESTree.ArrowFunctionExpression;

function findEnclosingFunction(node: TSESTree.Node): FunctionNode | undefined {
  let current: TSESTree.Node | null = node;
  while (current) {
    if (
      current.type === AST_NODE_TYPES.FunctionDeclaration ||
      current.type === AST_NODE_TYPES.FunctionExpression ||
      current.type === AST_NODE_TYPES.ArrowFunctionExpression
    ) {
      return current as FunctionNode;
    }
    current = (current as { parent?: TSESTree.Node }).parent ?? null;
  }
  return undefined;
}

function isGenericCallbackType(typeAnn: TSESTree.TypeNode): boolean {
  return (
    typeAnn.type === AST_NODE_TYPES.TSFunctionType &&
    (typeAnn.typeParameters?.params.length ?? 0) > 0
  );
}

function isParameterOf(name: string, fn: FunctionNode): boolean {
  return fn.params.some(
    (p) => p.type === AST_NODE_TYPES.Identifier && p.name === name,
  );
}

function getParamTypeAnnotation(
  name: string,
  fn: FunctionNode,
): TSESTree.TypeNode | undefined {
  const param = fn.params.find(
    (p): p is TSESTree.Identifier & { typeAnnotation?: TSESTree.TSTypeAnnotation } =>
      p.type === AST_NODE_TYPES.Identifier && p.name === name,
  );
  return param?.typeAnnotation?.typeAnnotation;
}

function isDeclaredInsideFn(name: string, fn: FunctionNode): boolean {
  if (isParameterOf(name, fn)) return true;

  const body = (fn.body as TSESTree.BlockStatement)?.body;
  if (!Array.isArray(body)) return false;

  for (const stmt of body) {
    if (stmt.type === AST_NODE_TYPES.VariableDeclaration) {
      for (const decl of stmt.declarations) {
        if (
          decl.id.type === AST_NODE_TYPES.Identifier &&
          decl.id.name === name
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

export default createRule({
  name: "no-captured-generic-callback-t59",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow capturing a function parameter with a generic callback type into an outer-scope variable",
    },
    messages: {
      capturedGenericCallback:
        "Generic callback parameter '{{paramName}}' is captured into an outer-scope variable '{{targetName}}', leaking the existential type witness. Keep the callback within its declaring scope. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T59-existential-types.md",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"capturedGenericCallback", []>) {
    function checkCapture(
      targetName: string,
      rhs: TSESTree.Expression,
      sourceNode: TSESTree.Node,
    ) {
      if (rhs.type !== AST_NODE_TYPES.Identifier || !("name" in rhs)) return;

      const rhsName = rhs.name;
      const fn = findEnclosingFunction(sourceNode);
      if (!fn) return;

      if (!isParameterOf(rhsName, fn)) return;

      const paramType = getParamTypeAnnotation(rhsName, fn);
      if (!paramType || !isGenericCallbackType(paramType)) return;

      if (isDeclaredInsideFn(targetName, fn)) return;

      context.report({
        node: sourceNode,
        messageId: "capturedGenericCallback",
        data: { paramName: rhsName, targetName },
      });
    }

    function checkMemberCapture(
      memberNode: TSESTree.MemberExpression,
      rhs: TSESTree.Expression,
      sourceNode: TSESTree.Node,
    ) {
      if (rhs.type !== AST_NODE_TYPES.Identifier || !("name" in rhs)) return;

      const rhsName = rhs.name;
      const fn = findEnclosingFunction(sourceNode);
      if (!fn) return;

      if (!isParameterOf(rhsName, fn)) return;

      const paramType = getParamTypeAnnotation(rhsName, fn);
      if (!paramType || !isGenericCallbackType(paramType)) return;

      const targetName =
       memberNode.object.type === AST_NODE_TYPES.Identifier
           ? memberNode.object.name
          : "<member>";

      context.report({
        node: sourceNode,
        messageId: "capturedGenericCallback",
        data: { paramName: rhsName, targetName },
      });
    }

    return {
      AssignmentExpression(node) {
        if (node.left.type === AST_NODE_TYPES.Identifier) {
          checkCapture(node.left.name, node.right, node);
        }
        if (node.left.type === AST_NODE_TYPES.MemberExpression) {
          checkMemberCapture(
            node.left as TSESTree.MemberExpression,
            node.right,
            node,
          );
        }
      },

      VariableDeclarator(node) {
        if (
          node.id.type === AST_NODE_TYPES.Identifier &&
          node.init?.type === AST_NODE_TYPES.Identifier
        ) {
          checkCapture(
            node.id.name,
            node.init,
            node,
          );
        }
      },
    };
  },
});
