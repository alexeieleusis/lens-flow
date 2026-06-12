import { AST_NODE_TYPES, TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { getKeys } from "eslint-visitor-keys";

function isNullishLiteral(node: TSESTree.Node): boolean {
  if (
    node.type === AST_NODE_TYPES.Literal &&
    node.value === null
  ) {
    return true;
  }
  if (
    node.type === AST_NODE_TYPES.Identifier &&
    node.name === "undefined"
  ) {
    return true;
  }
  return false;
}

function isNullishCoalesceWithLiteral(node: TSESTree.Node): boolean {
  const logicalNode = node as TSESTree.LogicalExpression;
  return (
    node.type === AST_NODE_TYPES.LogicalExpression &&
    logicalNode.operator === "??" &&
    (isNullishLiteral(logicalNode.left) ||
      isNullishLiteral(logicalNode.right))
  );
}

function isASTNode(val: unknown): val is TSESTree.Node {
  return val !== null && typeof val === "object" && "type" in val;
}

function tryVisitChild(child: TSESTree.Node, cb: (n: TSESTree.Node) => boolean): boolean {
  if (isASTNode(child) && cb(child)) {
    return true;
  }
  return false;
}

const FUNCTION_BOUNDARIES = new Set([
  AST_NODE_TYPES.FunctionDeclaration,
  AST_NODE_TYPES.FunctionExpression,
  AST_NODE_TYPES.ArrowFunctionExpression,
]);

function forEachChildNode(
  node: TSESTree.Node,
  cb: (child: TSESTree.Node) => boolean,
): boolean {
  for (const key of getKeys(node)) {
    const raw = (node as unknown as Record<string, unknown>)[key];
    if (Array.isArray(raw)) {
      for (const item of raw) {
        const child = item as TSESTree.Node;
        if (isASTNode(child)) {
          if (FUNCTION_BOUNDARIES.has(child.type)) continue;
          if (cb(child)) return true;
        }
      }
    } else {
      const child = raw as TSESTree.Node;
      if (isASTNode(child)) {
        if (FUNCTION_BOUNDARIES.has(child.type)) continue;
        if (cb(child)) return true;
      }
    }
  }
  return false;
}

function containsNullishCoalesceInChildren(
  node: TSESTree.Node,
): boolean {
  return forEachChildNode(node, (child) =>
    containsNullishCoalesce(child),
  );
}

function containsNullishCoalesce(node: TSESTree.Node): boolean {
  return (
    isNullishCoalesceWithLiteral(node) ||
    containsNullishCoalesceInChildren(node)
  );
}

function hasMatchingChildNode(
  node: TSESTree.Node,
  predicate: (n: TSESTree.Node) => boolean,
): boolean {
  return forEachChildNode(node, (child) =>
    predicate(child) || hasMatchingChildNode(child, predicate),
  );
}

function hasAnyNullishReturn(body: TSESTree.Node): boolean {
  if (
    body.type === AST_NODE_TYPES.ReturnStatement &&
    body.argument !== null
  ) {
    if (containsNullishCoalesce(body.argument)) {
      return true;
    }
  }

  return hasMatchingChildNode(body, hasAnyNullishReturn);
}

function checkFunction(
  node:
    | TSESTree.FunctionDeclaration
    | TSESTree.FunctionExpression
    | TSESTree.ArrowFunctionExpression,
): boolean {
  const retType = node.returnType?.typeAnnotation;
  if (retType?.type !== AST_NODE_TYPES.TSAnyKeyword) {
    return false;
  }

  // Arrow function with expression body: () => expr ?? null
  if (
    node.type === AST_NODE_TYPES.ArrowFunctionExpression &&
    node.expression
  ) {
    return containsNullishCoalesce(node.body);
  }

  // Block body (arrow with braces, function declaration, function expression)
  return hasAnyNullishReturn(node.body);
}

export default createRule({
  name: "no-any-nullable-return",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow functions with any return type that return nullish-coalesced expressions",
    },
    messages: {
      anyNullableReturn:
        "Function declares return type 'any' but returns a nullish-coalesced expression. Use a concrete return type instead (e.g., T | null). See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/usecases/UC16-nullability.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"anyNullableReturn", []>) {
    return {
      FunctionDeclaration(node) {
        if (checkFunction(node)) {
          context.report({
            node,
            messageId: "anyNullableReturn",
          });
        }
      },
      FunctionExpression(node) {
        if (checkFunction(node)) {
          context.report({
            node,
            messageId: "anyNullableReturn",
          });
        }
      },
      ArrowFunctionExpression(node) {
        if (checkFunction(node)) {
          context.report({
            node,
            messageId: "anyNullableReturn",
          });
        }
      },
    };
  },
});
