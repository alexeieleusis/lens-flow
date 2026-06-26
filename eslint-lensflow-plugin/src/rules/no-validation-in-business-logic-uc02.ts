import { createRule } from "../utils/rule-creator.js";
import type { TSESTree, TSESLint } from "@typescript-eslint/utils";

const ITERATOR_METHODS = new Set([
  "reduce",
  "map",
  "filter",
  "forEach",
  "flatMap",
  "some",
  "every",
]);

const COMPARISON_OPERATORS = new Set([
  "<",
  ">",
  "<=",
  ">=",
  "===",
  "!=",
  "!==",
  "==",
]);

function isCallback(
  node: TSESTree.Node,
): node is TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression {
  return node.type === "ArrowFunctionExpression" || node.type === "FunctionExpression";
}

function getParamNames(
  cb: TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression,
): Set<string> {
  const names = new Set<string>();
  for (const param of cb.params) {
    if (param.type === "Identifier") {
      names.add(param.name);
    }
  }
  return names;
}

function involvesParam(expr: TSESTree.Node, params: Set<string>): boolean {
  if (expr.type === "Identifier" && params.has(expr.name)) {
    return true;
  }
  if (expr.type === "MemberExpression") {
    return involvesParam((expr as TSESTree.MemberExpression).object, params);
  }
  return false;
}

const FUNCTION_BOUNDARY_TYPES = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
]);

function isFunctionBoundary(node: TSESTree.Node): boolean {
  return FUNCTION_BOUNDARY_TYPES.has(node.type);
}

function findThrow(node: TSESTree.Node): TSESTree.ThrowStatement | null {
  if (node.type === "ThrowStatement") {
    return node;
  }

  for (const child of collectChildren(node)) {
    if (isFunctionBoundary(child)) continue;
    const found = findThrow(child);
    if (found) return found;
  }
  return null;
}

function isLiteralLike(node: TSESTree.Node): boolean {
  if (node.type === "Literal") return true;
  if (
    node.type === "UnaryExpression" &&
    (node as TSESTree.UnaryExpression).operator === "-" &&
    (node as TSESTree.UnaryExpression).argument.type === "Literal"
  )
    return true;
  return false;
}

function collectChildren(node: TSESTree.Node): TSESTree.Node[] {
  const children: TSESTree.Node[] = [];

  for (const key of Object.keys(node)) {
    if (key === "parent" || key === "loc" || key === "range") continue;
    const val = (node as unknown as Record<string, unknown>)[key];
    if (Array.isArray(val)) {
      for (const item of val) {
        if (item && typeof item === "object" && "type" in item) {
          children.push(item as TSESTree.Node);
        }
      }
    } else if (val && typeof val === "object" && "type" in val) {
      children.push(val as TSESTree.Node);
    }
  }

  return children;
}

function walk(node: TSESTree.Node): TSESTree.Node[] {
  const result: TSESTree.Node[] = [];

  for (const child of collectChildren(node)) {
    if (isFunctionBoundary(child)) {
      continue;
    }
    result.push(child, ...walk(child));
  }
  return result;
}

function reportValidationInCallback(
  cb: TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression,
  context: Readonly<Parameters<NonNullable<Parameters<typeof createRule>[0]["create"]>>[0]>,
) {
  const params = getParamNames(cb);
  if (params.size === 0) return;

  const allNodes = walk(cb.body);
  const reported = new Set<TSESTree.ThrowStatement>();

  for (const descendant of allNodes) {
    if (descendant.type !== "IfStatement") continue;
    const ifNode = descendant;

    if (ifNode.test.type !== "BinaryExpression") continue;
    const bin = ifNode.test as TSESTree.BinaryExpression;
    if (!COMPARISON_OPERATORS.has(bin.operator)) continue;

    const hasParam =
      involvesParam(bin.left, params) || involvesParam(bin.right, params);
    const hasLiteral =
      isLiteralLike(bin.left) || isLiteralLike(bin.right);
    if (!hasParam || !hasLiteral) continue;

    let throwNode: TSESTree.ThrowStatement | null = null;
    throwNode = findThrow(ifNode.consequent);
    if (!throwNode && ifNode.alternate) {
      throwNode = findThrow(ifNode.alternate);
    }
    if (throwNode && !reported.has(throwNode)) {
      reported.add(throwNode);
      context.report({
        node: throwNode,
        messageId: "validationInIterator",
      });
    }
  }
}

export default createRule({
  name: "no-validation-in-business-logic-uc02",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow validation logic inside iterator callbacks; enforce invariants via domain types with smart constructors",
    },
    messages: {
      validationInIterator:
        "Validation logic inside iterator callback. Domain invariants should be enforced by smart constructors, not checked at use sites. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC02-domain-modeling.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"validationInIterator", []>) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== "MemberExpression") return;
        const prop = callee.property;
        if (prop.type !== "Identifier") return;
        if (!ITERATOR_METHODS.has(prop.name)) return;

        for (const arg of node.arguments) {
          if (!isCallback(arg)) continue;
          reportValidationInCallback(arg, context);
        }
      },
    };
  },
});
