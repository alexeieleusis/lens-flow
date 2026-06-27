import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

const FUNCTION_NODES = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
]);

function unwrapTSTypeAnnotation(node: unknown): unknown {
  if (
    node &&
    typeof node === "object" &&
    (node as Record<string, unknown>).type === "TSTypeAnnotation"
  ) {
    return (node as Record<string, unknown>).typeAnnotation;
  }
  return node;
}

function isUnionType(typeAnnotation: unknown): boolean {
  const unwrapped = unwrapTSTypeAnnotation(typeAnnotation);
  if (!unwrapped || typeof unwrapped !== "object") return false;
  const { type } = unwrapped as { type?: string };
  return type === "TSUnionType";
}

function findNearestEnclosingFunction(
  ancestors: unknown[],
): unknown {
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const obj = ancestors[i] as Record<string, unknown>;
    if (FUNCTION_NODES.has(obj.type as string)) {
      return obj;
    }
  }
  return null;
}

function getUnionParamNames(fnNode: unknown): Set<string> {
  const params = (fnNode as { params?: unknown[] }).params ?? [];
  const names = new Set<string>();
  for (const param of params) {
    const obj = param as Record<string, unknown>;
    // For AssignmentPattern, type annotation is on the left Identifier, not the pattern itself
    const typeAnn = obj.type === "AssignmentPattern" && obj.left && typeof obj.left === "object"
      ? ((obj.left as Record<string, unknown>).typeAnnotation ?? obj.typeAnnotation)
      : (obj as { typeAnnotation?: unknown }).typeAnnotation;
    if (!isUnionType(typeAnn)) continue;

    if (obj.type === "Identifier") {
      names.add(obj.name as string);
    } else if (
      obj.type === "AssignmentPattern" &&
      obj.left &&
      typeof obj.left === "object" &&
      (obj.left as Record<string, unknown>).type === "Identifier"
    ) {
      names.add((obj.left as Record<string, unknown>).name as string);
    }
  }
  return names;
}

function isDerivedFromParam(expr: unknown, paramNames: Set<string>): boolean {
  if (!expr || typeof expr !== "object") return false;
  const obj = expr as Record<string, unknown>;

  if (obj.type === "Identifier") {
    return paramNames.has(obj.name as string);
  }

  if (
    obj.type === "MemberExpression" &&
    obj.object &&
    typeof obj.object === "object"
  ) {
    const rootObj = obj.object as Record<string, unknown>;
    if (rootObj.type === "Identifier") {
      return paramNames.has(rootObj.name as string);
    }
  }

  return false;
}

export default createRule({
  name: "no-as-any-union-handling-uc14",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `as any` type assertions inside functions that handle discriminated union values, which bypass type narrowing and lose all type safety.",
    },
    messages: {
      asAnyBypassNarrowing:
        "Avoid casting `{{expr}}` to `any` inside a function with a union-typed parameter. Use proper type narrowing (e.g., `if (s.kind === \"circle\")`) instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC14-extensibility.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"asAnyBypassNarrowing", []>) {
    return {
      TSAsExpression(node) {
        if (node.typeAnnotation.type !== "TSAnyKeyword") return;

        const ancestors = context.sourceCode.getAncestors(node);
        const fnNode = findNearestEnclosingFunction(ancestors);
        if (!fnNode) return;

        const unionParamNames = getUnionParamNames(fnNode);
        if (unionParamNames.size === 0) return;
        const expression = node.expression;

        if (!isDerivedFromParam(expression, unionParamNames)) return;

        const exprName =
          expression &&
          typeof expression === "object" &&
          (expression as unknown as Record<string, unknown>).type === "Identifier"
            ? (expression as unknown as Record<string, unknown>).name
            : "expression";

        context.report({
          node,
          messageId: "asAnyBypassNarrowing",
          data: { expr: String(exprName) },
        });
      },
    };
  },
});
