import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

function findAnyParams(
  params: readonly unknown[],
): Array<{ name: string; anyNode: unknown }> {
  const results: Array<{ name: string; anyNode: unknown }> = [];

  for (const param of params) {
    if ((param as { type?: string }).type === "TSParameterProperty") continue;

    const base =
      (param as { type?: string }).type === "AssignmentPattern"
        ? ((param as { left?: unknown }).left as object)
        : param;

    const typeAnn = (base as { typeAnnotation?: { typeAnnotation?: { type: string } } }).typeAnnotation
      ?.typeAnnotation;

    if (typeAnn?.type === "TSAnyKeyword") {
      const name = (base as { name?: string }).name ?? "unnamed";
      results.push({ name, anyNode: typeAnn });
    }
  }

  return results;
}

function isIdentifier(node: unknown, name: string): boolean {
  const n = node as Record<string, unknown> | undefined;
  return n?.type === "Identifier" && n.name === name;
}

function bodyOnlyNarrows(
  body: unknown,
  paramName: string,
): boolean {
  let hasNarrowing = false;
  let hasUnsafeDirectAccess = false;

  const skipKeys = new Set(["parent", "scope"]);
  const narrowingScope: Set<string>[] = [];

  function checkInstanceof(n: Record<string, unknown>): boolean {
    if (n.type !== "BinaryExpression" || n.operator !== "instanceof") return false;
    const left = n.left as Record<string, unknown> | undefined;
    return isIdentifier(left, paramName);
  }

  function checkBinaryExpression(n: Record<string, unknown>): boolean {
    if (n.type !== "BinaryExpression") return false;
    const left = n.left as Record<string, unknown> | undefined;

    if (
      left?.type === "UnaryExpression" &&
      left.operator === "typeof"
    ) {
      const arg = left.argument as Record<string, unknown> | undefined;
      if (isIdentifier(arg, paramName)) return true;
    }

    if (isIdentifier(left, paramName)) {
      const right = n.right as Record<string, unknown> | undefined;
      if (
        right?.type === "Literal" &&
        typeof right.value === "string"
      ) {
        return true;
      }
    }

    return false;
  }

  function checkUnaryTypeof(n: Record<string, unknown>): boolean {
    if (n.type !== "UnaryExpression" || n.operator !== "typeof") return false;
    const arg = n.argument as Record<string, unknown> | undefined;
    return isIdentifier(arg, paramName);
  }

  function detectNarrowingParam(testNode: unknown): string | null {
    if (!testNode || typeof testNode !== "object") return null;
    const t = testNode as Record<string, unknown>;

    if (checkInstanceof(t) || checkBinaryExpression(t) || checkUnaryTypeof(t)) {
      hasNarrowing = true;
      return paramName;
    }

    return null;
  }

  function visitIfStatement(n: Record<string, unknown>, parent: unknown): void {
    const ifNode = n as {
      test: unknown;
      consequent: unknown;
      alternate?: unknown;
    };

    const narrowedParam = detectNarrowingParam(ifNode.test);

    visit(ifNode.test, parent);

    if (narrowedParam) {
      narrowingScope.push(new Set([narrowedParam]));
      visit(ifNode.consequent, parent);
      narrowingScope.pop();
    } else {
      visit(ifNode.consequent, parent);
    }

    if (ifNode.alternate) {
      visit(ifNode.alternate, parent);
    }
  }

  function checkIdentifierUsage(currentNode: unknown, parent: unknown): void {
    const p = parent as Record<string, unknown>;

    if (
      p.type === "UnaryExpression" &&
      p.operator === "typeof" &&
      p.argument === currentNode
    ) {
      hasNarrowing = true;
      return;
    }

    if (
      p.type === "BinaryExpression" &&
      p.operator === "instanceof" &&
      p.left === currentNode
    ) {
      hasNarrowing = true;
      return;
    }

    if (p.type === "MemberExpression" && p.object === currentNode) {
      const isNarrowed = narrowingScope.some((s) => s.has(paramName));
      if (!isNarrowed) {
        hasUnsafeDirectAccess = true;
      }
    }
  }

  function recurseChildren(n: Record<string, unknown>, currentNode: unknown): void {
    for (const [key, value] of Object.entries(n)) {
      if (skipKeys.has(key)) continue;

      if (Array.isArray(value)) {
        for (const child of value) {
          visit(child, currentNode);
        }
      } else if (value && typeof value === "object") {
        visit(value, currentNode);
      }
    }
  }

  function visit(node: unknown, parent: unknown): void {
    if (!node || typeof node !== "object") return;
    const n = node as Record<string, unknown>;

    if (n.type === "IfStatement") {
      visitIfStatement(n, parent);
      return;
    }

    if (n.type === "Identifier" && n.name === paramName && parent) {
      checkIdentifierUsage(node, parent);
      return;
    }

    recurseChildren(n, node);
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
    function visitFunction(node: {
      params: readonly unknown[];
      body?: unknown;
    }) {
      if (!node.body) return;

      const anyParams = findAnyParams(node.params);

      for (const { name, anyNode } of anyParams) {
        if (bodyOnlyNarrows(node.body, name)) {
          context.report({
            node: anyNode as never,
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
    };
  },
});
