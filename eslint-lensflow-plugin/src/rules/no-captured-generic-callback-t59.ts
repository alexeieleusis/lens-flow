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

const SKIP_KEYS = new Set([
  "parent",
  "loc",
  "range",
  "start",
  "end",
  "tokens",
  "comments",
  "typeAnnotation",
  "typeArguments",
  "returnType",
  "key",
  "typeParameters",
]);

function hasVariableDeclaration(node: TSESTree.Node, name: string): boolean {
  if (node.type === AST_NODE_TYPES.VariableDeclaration) {
    if (
      (node as TSESTree.VariableDeclaration).declarations.some(
        (d) => d.id.type === AST_NODE_TYPES.Identifier && d.id.name === name,
      )
    ) {
      return true;
    }
  }

  for (const [key, value] of Object.entries(node)) {
    if (SKIP_KEYS.has(key) || value === null || value === undefined) continue;
    if (typeof value !== "object") continue;

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== null && typeof item === "object" && "type" in item) {
          if (hasVariableDeclaration(item as TSESTree.Node, name)) return true;
        }
      }
    } else if ("type" in value && typeof value.type === "string") {
      if (hasVariableDeclaration(value as TSESTree.Node, name)) return true;
    }
  }
  return false;
}

function isDeclaredInsideFn(name: string, fn: FunctionNode): boolean {
  if (isParameterOf(name, fn)) return true;

  const body = fn.body as TSESTree.BlockStatement | TSESTree.Node;
  if (!body) return false;

  // For block-bodied functions, scan all statements recursively.
  // For arrow functions with expression bodies, there are no local declarations.
  if (body.type === AST_NODE_TYPES.BlockStatement) {
    return body.body.some((stmt) => hasVariableDeclaration(stmt, name));
  }
  return false;
}

export default createRule({
  name: "no-captured-generic-callback-t59",
  meta: {
    type: "problem",
    fixable: undefined,
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
    function isGenericCallbackParam(
      rhs: TSESTree.Expression,
      sourceNode: TSESTree.Node,
    ): { paramName: string; fn: FunctionNode } | undefined {
      if (rhs.type !== AST_NODE_TYPES.Identifier || !("name" in rhs)) return;

      const paramName = rhs.name;
      const fn = findEnclosingFunction(sourceNode);
      if (!fn) return;

      if (!isParameterOf(paramName, fn)) return;

      const paramType = getParamTypeAnnotation(paramName, fn);
      if (!paramType || !isGenericCallbackType(paramType)) return;

      return { paramName, fn };
    }

    function checkCapture(
      targetName: string,
      rhs: TSESTree.Expression,
      sourceNode: TSESTree.Node,
    ) {
      const result = isGenericCallbackParam(rhs, sourceNode);
      if (!result) return;

      if (isDeclaredInsideFn(targetName, result.fn)) return;

      context.report({
        node: sourceNode,
        messageId: "capturedGenericCallback",
        data: { paramName: result.paramName, targetName },
      });
    }

    function checkMemberCapture(
      memberNode: TSESTree.MemberExpression,
      rhs: TSESTree.Expression,
      sourceNode: TSESTree.Node,
    ) {
      const result = isGenericCallbackParam(rhs, sourceNode);
      if (!result) return;

      const targetName =
        memberNode.object.type === AST_NODE_TYPES.Identifier
          ? memberNode.object.name
          : "<member>";

      if (
        memberNode.object.type === AST_NODE_TYPES.Identifier &&
        isDeclaredInsideFn(memberNode.object.name, result.fn)
      ) {
        return;
      }

      context.report({
        node: sourceNode,
        messageId: "capturedGenericCallback",
        data: { paramName: result.paramName, targetName },
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
