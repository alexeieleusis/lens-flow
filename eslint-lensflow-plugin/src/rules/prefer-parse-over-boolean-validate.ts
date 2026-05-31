import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

const VALIDATION_NAME_RE = /^(is|validate|check)[A-Z]/;

type FunctionNode = TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression;

function isBooleanReturn(
  node: FunctionNode,
): boolean {
  return node.returnType?.typeAnnotation.type === "TSBooleanKeyword";
}

function getName(
  node: FunctionNode,
): string | null {
  if (node.type === "FunctionDeclaration" && node.id) return node.id.name;
  if (node.type === "FunctionExpression" && node.id) return node.id.name;
  if (
    node.parent?.type === "Property" &&
    node.parent.key.type === "Identifier"
  ) {
    return node.parent.key.name;
  }
  if (
    node.type === "ArrowFunctionExpression" &&
    node.parent?.type === "VariableDeclarator" &&
    node.parent.id.type === "Identifier"
  ) {
    return node.parent.id.name;
  }
  return null;
}

function isMetaKey(key: string): boolean {
  return key === "parent" || key === "loc" || key === "range" || key === "type";
}

function isNodeLike(val: unknown): val is TSESTree.Node {
  return typeof val === "object" && val != null && "type" in val;
}

function collectChildren(node: TSESTree.Node): TSESTree.Node[] {
  const result: TSESTree.Node[] = [];
  for (const key of Object.keys(node)) {
    if (isMetaKey(key)) continue;
    const val = (node as unknown as Record<string, unknown>)[key];
    if (val == null) continue;
    if (Array.isArray(val)) {
      for (const item of val) {
        if (isNodeLike(item)) {
          result.push(item);
        }
      }
    } else if (isNodeLike(val)) {
      result.push(val);
    }
  }
  return result;
}

function hasRegexTest(node: TSESTree.CallExpression): boolean {
  const callee = node.callee;
  if (callee.type !== "MemberExpression") return false;
  const property = callee.property;
  return property.type === "Identifier" && property.name === "test";
}

function hasTypeofCheck(node: TSESTree.BinaryExpression): boolean {
  const leftIsTypeof =
    node.left.type === "UnaryExpression" &&
    (node.left as TSESTree.UnaryExpression).operator === "typeof";
  const rightIsTypeof =
    node.right.type === "UnaryExpression" &&
    (node.right as TSESTree.UnaryExpression).operator === "typeof";
  return leftIsTypeof || rightIsTypeof;
}

function hasValidationLogic(body: TSESTree.Node): boolean {
  const stack: TSESTree.Node[] = [body];

  while (stack.length) {
    const current = stack.pop()!;

    if (current.type === "CallExpression" && hasRegexTest(current)) {
      return true;
    }

    if (current.type === "BinaryExpression" && hasTypeofCheck(current)) {
      return true;
    }

    stack.push(...collectChildren(current));
  }

  return false;
}

export default createRule({
  name: "prefer-parse-over-boolean-validate",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer parser functions that return a refined type over boolean validators that lose type information",
    },
    messages: {
      preferParse:
        "Function '{{name}}' returns boolean and contains validation logic. Consider returning a refined type or null instead, so the caller holds typed evidence of validity. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/usecases/UC01-invalid-states.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"preferParse", []>) {
    function checkFunction(node: FunctionNode) {
      if (!isBooleanReturn(node)) return;

      const name = getName(node);
      if (name === null || !VALIDATION_NAME_RE.test(name)) return;

      const body = node.body;
      if (body.type !== "BlockStatement") return;

      if (!hasValidationLogic(body)) return;

      context.report({
        node,
        messageId: "preferParse",
        data: { name },
      });
    }

    return {
      FunctionDeclaration(node) {
        checkFunction(node);
      },
      FunctionExpression(node) {
        checkFunction(node);
      },
      ArrowFunctionExpression(node) {
        checkFunction(node);
      },
    };
  },
});
