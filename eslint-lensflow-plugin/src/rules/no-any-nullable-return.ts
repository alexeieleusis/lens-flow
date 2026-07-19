import { AST_NODE_TYPES, TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { walkNodes } from "../utils/ast-helpers.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("usecases/UC16-nullability.md");

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

function containsNullishCoalesce(body: TSESTree.Node): boolean {
  return walkNodes(body, (node) => {
    if (node.type !== AST_NODE_TYPES.LogicalExpression) return false;
    return isNullishCoalesceWithLiteral(node);
  });
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

  // Block body: check for return statements with nullish-coalesced expressions
  return walkNodes(node.body, (child) => {
    if (
      child.type === AST_NODE_TYPES.ReturnStatement &&
      child.argument !== null
    ) {
      return containsNullishCoalesce(child.argument);
    }
    return false;
  });
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
        "Function declares return type 'any' but returns a nullish-coalesced expression. Use a concrete return type instead (e.g., T | null). See: {{url}}",
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
            data: { url: URL },
          });
        }
      },
      FunctionExpression(node) {
        if (checkFunction(node)) {
          context.report({
            node,
            messageId: "anyNullableReturn",
            data: { url: URL },
          });
        }
      },
      ArrowFunctionExpression(node) {
        if (checkFunction(node)) {
          context.report({
            node,
            messageId: "anyNullableReturn",
            data: { url: URL },
          });
        }
      },
    };
  },
});
