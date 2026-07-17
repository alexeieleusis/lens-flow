import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

const PRIMITIVE_TYPES = new Set([
  "TSStringKeyword",
  "TSNumberKeyword",
  "TSBooleanKeyword",
  "TSBigIntKeyword",
]);

function isBrandedType(node: TSESTree.TypeNode): boolean {
  if (node.type !== "TSIntersectionType") return false;

  const hasPrimitive = node.types.some((m) =>
    PRIMITIVE_TYPES.has(m.type as string),
  );
  const hasBrandLiteral = node.types.some(
    (m) =>
      m.type === "TSTypeLiteral" &&
      m.members.some((member) => {
        if (member.type !== "TSPropertySignature" || !member.key) return false;
        const key = member.key;
        if (key.type !== "Identifier" && key.type !== "Literal") return false;
        let name: string | null = null;
        if (key.type === "Identifier") {
          name = key.name;
        } else if (typeof key.value === "string") {
          name = key.value;
        }
        if (!name) return false;
        return (
          name === "_brand" ||
          name === "__brand" ||
          name.endsWith("Brand")
        );
      }),
  );

  return hasPrimitive && hasBrandLiteral;
}

function isNoopCastBody(
  body: TSESTree.BlockStatement | TSESTree.Expression,
  paramNames: Set<string>,
): boolean {
  // Arrow function without braces: body is the expression directly
  if (body.type !== "BlockStatement") {
    if (body.type !== "TSAsExpression") return false;
    const expr = body.expression;
    if (expr.type !== "Identifier") return false;
    return paramNames.has(expr.name);
  }

  // Block body: must be exactly one return statement
  if (body.body.length !== 1) return false;

  const stmt = body.body[0];
  if (stmt.type !== "ReturnStatement" || !stmt.argument) return false;

  const arg = stmt.argument;
  if (arg.type !== "TSAsExpression") return false;

  const expr = arg.expression;
  if (expr.type !== "Identifier") return false;
  if (!paramNames.has(expr.name)) return false;

  return true;
}

export default createRule({
  name: "no-noop-brand-constructor",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow functions that return a branded type by simply casting a parameter without validation.",
    },
    messages: {
      noopBrandConstructor:
        "Constructor '{{name}}' performs no validation — it simply casts to the branded type. Either add a predicate check or use the primitive type directly. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T26-refinement-types.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"noopBrandConstructor", []>) {
    function checkFunction(
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression,
    ) {
      if (!node.returnType) return;

      const returnAnn = node.returnType.typeAnnotation;
      if (!isBrandedType(returnAnn)) return;

      const paramNames = new Set(
        node.params
          .map((p) => {
            if (p.type === "Identifier") return p;
            if (p.type === "AssignmentPattern" && p.left.type === "Identifier")
              return p.left;
            return null;
          })
          .filter((p): p is TSESTree.Identifier => p !== null)
          .map((p) => p.name),
      );

      if (paramNames.size === 0) return;
      if (!isNoopCastBody(node.body, paramNames)) return;

      const funcName =
        node.type === "FunctionDeclaration" && node.id
          ? node.id.name
          : "anonymous";

      context.report({
        node,
        messageId: "noopBrandConstructor",
        data: { name: funcName },
      });
    }

    return {
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction,
    };
  },
});
