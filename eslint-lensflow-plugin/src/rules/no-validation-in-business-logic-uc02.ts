import { createRule } from "../utils/rule-creator.js";
import { getChildren } from "../utils/ast-helpers.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESTree, TSESLint } from "@typescript-eslint/utils";

const URL = knowledgeUrl("usecases/UC02-domain-modeling.md");

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

function extractIdentifiers(node: TSESTree.Node, names: Set<string>): void {
  if (node.type === "Identifier") {
    names.add(node.name);
  } else if (node.type === "ObjectPattern") {
    for (const prop of node.properties) {
      if (prop.value) extractIdentifiers(prop.value, names);
    }
  } else if (node.type === "ArrayPattern") {
    for (const element of node.elements) {
      if (element) extractIdentifiers(element, names);
    }
  } else if (node.type === "RestElement") {
    extractIdentifiers(node.argument, names);
  } else if (node.type === "AssignmentPattern") {
    extractIdentifiers(node.left, names);
  }
}

function getParamNames(
  cb: TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression,
): Set<string> {
  const names = new Set<string>();
  for (const param of cb.params) {
    extractIdentifiers(param, names);
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

  for (const child of getChildren(node)) {
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

// Replaced with shared getChildren() from ast-helpers to use eslint-visitor-keys
// for proper child enumeration instead of fragile Object.keys() iteration.

function walk(node: TSESTree.Node): TSESTree.Node[] {
  const result: TSESTree.Node[] = [];

  for (const child of getChildren(node)) {
    if (isFunctionBoundary(child)) {
      continue;
    }
    result.push(child, ...walk(child));
  }
  return result;
}

function isValidationComparison(bin: TSESTree.BinaryExpression, params: Set<string>): boolean {
  const hasParam = involvesParam(bin.left, params) || involvesParam(bin.right, params);
  const hasLiteral = isLiteralLike(bin.left) || isLiteralLike(bin.right);
  return hasParam && hasLiteral;
}

function findThrowInBothBranches(ifNode: TSESTree.IfStatement): TSESTree.ThrowStatement | null {
  let throwNode = findThrow(ifNode.consequent);
  if (!throwNode && ifNode.alternate) {
    throwNode = findThrow(ifNode.alternate);
  }
  return throwNode;
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

    if (!isValidationComparison(bin, params)) continue;

    const throwNode = findThrowInBothBranches(ifNode);
    if (throwNode && !reported.has(throwNode)) {
      reported.add(throwNode);
      context.report({
        node: throwNode,
        messageId: "validationInIterator",
        data: { url: URL },
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
        "Validation logic inside iterator callback. Domain invariants should be enforced by smart constructors, not checked at use sites. See: {{url}}",
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
