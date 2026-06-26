import { createRule } from "../utils/rule-creator.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

function findAnyParams(
  params: readonly TSESTree.Parameter[],
): Array<{ name: string; anyNode: TSESTree.TSAnyKeyword }> {
  const results: Array<{ name: string; anyNode: TSESTree.TSAnyKeyword }> = [];

  for (const param of params) {
    if (param.type === "TSParameterProperty") continue;

    const base =
      param.type === "AssignmentPattern"
        ? param.left
        : param;

    const typeAnn = (base as TSESTree.Identifier | TSESTree.ObjectPattern | TSESTree.ArrayPattern)
      .typeAnnotation?.typeAnnotation;

    if (typeAnn?.type === "TSAnyKeyword") {
      const name = (base as TSESTree.Identifier).name ?? "unnamed";
      results.push({ name, anyNode: typeAnn as TSESTree.TSAnyKeyword });
    }
  }

  return results;
}

function isIdentifier(node: TSESTree.Node | undefined, name: string): boolean {
  return node?.type === "Identifier" && node.name === name;
}

function bodyOnlyNarrows(
  body: TSESTree.BlockStatement,
  paramName: string,
): boolean {
  let hasNarrowing = false;
  let hasUnsafeDirectAccess = false;

  const skipKeys = new Set(["parent", "scope"]);
  const narrowingScope: Set<string>[] = [];

  function checkInstanceof(n: TSESTree.BinaryExpression): boolean {
    if (n.type !== "BinaryExpression" || n.operator !== "instanceof") return false;
    return isIdentifier(n.left, paramName);
  }

  function checkBinaryExpression(n: TSESTree.BinaryExpression): boolean {
    if (n.type !== "BinaryExpression") return false;

    if (
      n.left.type === "UnaryExpression" &&
      n.left.operator === "typeof"
    ) {
      if (isIdentifier(n.left.argument, paramName)) return true;
    }

    if (isIdentifier(n.left, paramName)) {
      if (
        n.right.type === "Literal" &&
        typeof n.right.value === "string"
      ) {
        return true;
      }
    }

    return false;
  }

  function checkUnaryTypeof(n: TSESTree.UnaryExpression): boolean {
    if (n.type !== "UnaryExpression" || n.operator !== "typeof") return false;
    return isIdentifier(n.argument, paramName);
  }

  function detectNarrowingParam(testNode: TSESTree.Node): string | null {
    const t = testNode;

    if (
      (t.type === "BinaryExpression" && (checkInstanceof(t) || checkBinaryExpression(t))) ||
      (t.type === "UnaryExpression" && checkUnaryTypeof(t))
    ) {
      hasNarrowing = true;
      return paramName;
    }

    return null;
  }

  function visitIfStatement(n: TSESTree.IfStatement, parent: TSESTree.Node | null): void {
    const narrowedParam = detectNarrowingParam(n.test);

    visit(n.test, parent);

    if (narrowedParam) {
      narrowingScope.push(new Set([narrowedParam]));
      visit(n.consequent, parent);
      narrowingScope.pop();
    } else {
      visit(n.consequent, parent);
    }

    if (n.alternate) {
      visit(n.alternate, parent);
    }
  }

  function checkIdentifierUsage(currentNode: TSESTree.Identifier, parent: TSESTree.Node): void {
    if (
      parent.type === "UnaryExpression" &&
      parent.operator === "typeof" &&
      parent.argument === currentNode
    ) {
      hasNarrowing = true;
      return;
    }

    if (
      parent.type === "BinaryExpression" &&
      parent.operator === "instanceof" &&
      parent.left === currentNode
    ) {
      hasNarrowing = true;
      return;
    }

    if (parent.type === "MemberExpression" && parent.object === currentNode) {
      const isNarrowed = narrowingScope.some((s) => s.has(paramName));
      if (!isNarrowed) {
        hasUnsafeDirectAccess = true;
      }
    }
  }

  function recurseChildren(n: TSESTree.Node, currentNode: TSESTree.Node): void {
    const record = n as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(record)) {
      if (skipKeys.has(key)) continue;

      if (Array.isArray(value)) {
        for (const child of value) {
          if (child && typeof child === "object") {
            visit(child as TSESTree.Node, currentNode);
          }
        }
      } else if (value && typeof value === "object") {
        visit(value as TSESTree.Node, currentNode);
      }
    }
  }

  const functionBoundaryTypes = new Set([
    "FunctionDeclaration",
    "FunctionExpression",
    "ArrowFunctionExpression",
  ]);

  function visit(node: TSESTree.Node, parent: TSESTree.Node | null): void {
    if (node.type === "IfStatement") {
      visitIfStatement(node, parent);
      return;
    }

    if (node.type === "Identifier" && node.name === paramName && parent) {
      checkIdentifierUsage(node, parent);
      return;
    }

    if (functionBoundaryTypes.has(node.type)) {
      return;
    }

    recurseChildren(node, node);
  }

  visit(body, null);

  return hasNarrowing && !hasUnsafeDirectAccess;
}

export default createRule({
  name: "prefer-unknown-over-any",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer `unknown` over `any` for function parameters that are only narrowed, never directly accessed",
    },
    messages: {
      preferUnknown:
        "Parameter `{{name}}` is typed as `any` but is only used in narrowing expressions. Use `unknown` instead, which forces type-safe narrowing. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T47-gradual-typing.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"preferUnknown", []>) {
    function visitFunction(node: TSESTree.FunctionLike) {
      if (!node.body) return;

      if (node.body.type !== "BlockStatement") return;
      const body = node.body;

      const anyParams = findAnyParams(node.params);

      for (const { name, anyNode } of anyParams) {
        if (bodyOnlyNarrows(body, name)) {
          context.report({
            node: anyNode,
            messageId: "preferUnknown",
            data: { name },
          });
        }
      }
    }

    return {
      FunctionDeclaration: visitFunction,
      FunctionExpression: visitFunction,
      ArrowFunctionExpression: visitFunction,
      TSEmptyBodyFunctionExpression: visitFunction,
      TSFunctionType(_node: TSESTree.TSFunctionType) {
        // Type-only construct with no body to analyze narrowing — skip.
      },
      TSMethodSignature(_node: TSESTree.TSMethodSignature) {
        // Type-only construct with no body to analyze narrowing — skip.
      },
      MethodDefinition(node: TSESTree.MethodDefinition) {
        if (node.value) {
          visitFunction(node.value);
        }
      },
    };
  },
});
