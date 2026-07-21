import { TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESLint } from "@typescript-eslint/utils";

const URL = knowledgeUrl("catalog/T64-async-iteration.md");

function extractYieldExpr(
  forOfBody: TSESTree.BlockStatement | TSESTree.ExpressionStatement,
): TSESTree.Expression | null {
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

function isLiteralNode(node: TSESTree.Node): boolean {
  if (node.type === "Literal") return true;
  if (node.type === "TemplateLiteral") return node.expressions.length === 0;
  if (node.type === "UnaryExpression") {
    return node.operator === "-" && isLiteralNode(node.argument);
  }
  return false;
}

function extractLoopTargetName(forOf: TSESTree.ForOfStatement): string | null {
  const left = forOf.left;
  if (left.type === "VariableDeclaration") {
    const id = left.declarations[0].id;
    if (id.type === "Identifier") return id.name;
    return null;
  }
  if (left.type === "Identifier") {
    return left.name;
  }
  return null;
}

function isArrayOfLiterals(expr: TSESTree.Node): boolean {
  if (expr.type !== "ArrayExpression") return false;
  return expr.elements.every(
    (el) => el !== null && el.type !== "SpreadElement" && isLiteralNode(el),
  );
}

function checkForOfPattern(
  forOf: TSESTree.ForOfStatement,
  declName: string,
  loopTargetName: string,
): boolean {
  if (forOf.right.type !== "Identifier") return false;
  if (forOf.right.name !== declName) return false;

  const body = forOf.body as
    TSESTree.BlockStatement | TSESTree.ExpressionStatement;
  const yieldExpr = extractYieldExpr(body);
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
        "This async generator simply yields from a static literal array with {{count}} element(s). Return the array directly instead. See: {{url}}",
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
  create(
    context: TSESLint.RuleContext<
      "staticAsyncGenerator",
      [{ maxElements: number }]
    >,
  ) {
    const [{ maxElements } = { maxElements: 5 }] = context.options ?? [];

    function extractArrayDecl(stmts: TSESTree.Statement[]) {
      if (stmts.length !== 2) return null;

      const [firstStmt, secondStmt] = stmts;
      if (firstStmt.type !== "VariableDeclaration") return null;
      if (firstStmt.declarations.length !== 1) return null;

      const decl = firstStmt.declarations[0];
      if (!decl.init || !isArrayOfLiterals(decl.init)) return null;
      if (decl.id.type !== "Identifier" || !decl.id.name) return null;

      const init = decl.init as TSESTree.ArrayExpression;
      if (init.elements.length > maxElements) return null;
      if (secondStmt.type !== "ForOfStatement") return null;

      return {
        declName: decl.id.name,
        init,
        secondStmt,
      } as const;
    }

    function checkFunctionNode(
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression,
    ) {
      if (!node.generator || !node.async) return;
      if (node.body?.type !== "BlockStatement") return;

      const result = extractArrayDecl(node.body.body);
      if (!result) return;

      const { declName, init, secondStmt } = result;

      const loopTargetName = extractLoopTargetName(secondStmt);
      if (!loopTargetName) return;

      if (!checkForOfPattern(secondStmt, declName, loopTargetName)) return;

      context.report({
        node,
        messageId: "staticAsyncGenerator",
        data: {
          count: String(init.elements.length),
          url: URL,
        },
      });
    }

    return {
      FunctionDeclaration: checkFunctionNode,
      FunctionExpression: checkFunctionNode,
      ArrowFunctionExpression: checkFunctionNode,
      MethodDefinition(node: TSESTree.MethodDefinition) {
        const value = node.value;
        if (value.type === "FunctionExpression") {
          checkFunctionNode(value);
        }
      },
    };
  },
});
