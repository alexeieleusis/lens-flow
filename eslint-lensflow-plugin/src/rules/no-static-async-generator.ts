import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

function extractYieldExpr(forOfBody: any): any {
  if (forOfBody.type === "BlockStatement") {
    if (forOfBody.body.length !== 1) return null;
    const yieldStmt = forOfBody.body[0];
    if (yieldStmt.type !== "ExpressionStatement") return null;
    return yieldStmt.expression;
  }
  if (forOfBody.type === "ExpressionStatement") {
    return forOfBody.expression;
  }
  return null;
}

function isLiteralNode(node: any): boolean {
  return (
    node.type === "Literal" ||
    node.type === "BooleanLiteral" ||
    node.type === "NullLiteral" ||
    node.type === "RegExpLiteral" ||
    node.type === "TemplateLiteral" &&
      node.expressions.length === 0 ||
    node.type === "UnaryExpression" &&
    node.operator === "-" &&
    isLiteralNode(node.argument)
  );
}

function extractLoopTargetName(forOf: any): string | null {
  return forOf.left.declarations
    ? forOf.left.declarations[0].id?.name ?? null
    : forOf.left?.name ?? null;
}

function isArrayOfLiterals(expr: any): boolean {
  return (
    expr.type === "ArrayExpression" &&
    expr.elements.every(
      (el: any) => el !== null && isLiteralNode(el)
    )
  );
}

function checkForOfPattern(forOf: any, declName: string, loopTargetName: string): boolean {
  if (forOf.right.type !== "Identifier") return false;
  if (forOf.right.name !== declName) return false;

  const yieldExpr = extractYieldExpr(forOf.body);
  if (yieldExpr?.type !== "YieldExpression") return false;

  const yieldArg = yieldExpr.argument;
  if (yieldArg?.type !== "Identifier") return false;
  if (yieldArg.name !== loopTargetName) return false;

  return true;
}

export default createRule({
  name: "no-static-async-generator",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow async generators that simply yield elements from a small static literal array",
    },
    messages: {
      staticAsyncGenerator:
        "This async generator simply yields from a static literal array with {{count}} element(s). Return the array directly instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T64-async-iteration.md",
    },
    schema: [
      {
        type: "object",
        properties: {
          maxElements: {
            type: "number",
            minimum: 1,
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
  },
  defaultOptions: [{ maxElements: 5 }],
  create(context: TSESLint.RuleContext<"staticAsyncGenerator", [{ maxElements: number }]>) {
    const [{ maxElements } = { maxElements: 5 }] = context.options ?? [];

    function extractArrayDecl(stmts: any[]): { decl: any; secondStmt: any } | null {
      if (stmts.length !== 2) return null;

      const [firstStmt, secondStmt] = stmts;
      if (firstStmt.type !== "VariableDeclaration") return null;
      if (firstStmt.declarations.length !== 1) return null;

      const decl = firstStmt.declarations[0];
      if (!decl.init || !isArrayOfLiterals(decl.init)) return null;
      if (decl.init.elements.length > maxElements) return null;
      if (!decl.id.name) return null;

      return { decl, secondStmt };
    }

    function checkFunctionNode(node: any) {
      if (!node.generator || !node.async) return;
      if (node.body?.type !== "BlockStatement") return;

      const result = extractArrayDecl(node.body.body);
      if (!result) return;

      const { decl, secondStmt } = result;
      if (secondStmt.type !== "ForOfStatement") return;

      const loopTargetName = extractLoopTargetName(secondStmt);
      if (!loopTargetName) return;

      if (!checkForOfPattern(secondStmt, decl.id.name, loopTargetName)) return;

      context.report({
        node,
        messageId: "staticAsyncGenerator",
        data: {
          count: String(decl.init.elements.length),
        },
      });
    }

    return {
      FunctionDeclaration: checkFunctionNode,
      FunctionExpression: checkFunctionNode,
      ArrowFunctionExpression: checkFunctionNode,
    };
  },
});
