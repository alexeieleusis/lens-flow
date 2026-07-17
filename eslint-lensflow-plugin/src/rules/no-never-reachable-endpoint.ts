import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

function isLiteralTrue(node: TSESTree.Expression | null | undefined): boolean {
  return node?.type === "Literal" && node.value === true;
}

function isTerminating(
  stmt: TSESTree.Statement,
  neverFunctions: Set<string>,
): boolean {
  switch (stmt.type) {
    case "FunctionDeclaration":
      return false;
    case "ReturnStatement":
      return !stmt.argument;
    case "ThrowStatement":
      return true;
    case "WhileStatement":
      return isLiteralTrue(stmt.test);
    case "ForStatement":
      return (
        !stmt.init &&
        !stmt.update &&
        (stmt.test === null || isLiteralTrue(stmt.test))
      );
    case "IfStatement":
      if (!stmt.alternate) return false;
      return (
        isTerminating(stmt.consequent, neverFunctions) &&
        isTerminating(stmt.alternate, neverFunctions)
      );
    case "SwitchStatement": {
      const hasDefault = stmt.cases.some((c) => c.test === null);
      if (!hasDefault) return false;
      const cases = stmt.cases;
      const caseTerminates = cases.map((c) => {
        const last = c.consequent[c.consequent.length - 1];
        return last ? isTerminating(last, neverFunctions) : false;
      });
      let nextTerminates = false;
      for (let i = cases.length - 1; i >= 0; i--) {
        if (!caseTerminates[i] && !nextTerminates) return false;
        nextTerminates = caseTerminates[i] || nextTerminates;
      }
      return true;
    }
    case "LabeledStatement":
      return isTerminating(stmt.body, neverFunctions);
    case "BlockStatement": {
      const last = stmt.body[stmt.body.length - 1];
      return last ? isTerminating(last, neverFunctions) : false;
    }
    case "ExpressionStatement": {
      const expr = stmt.expression;
      if (
        expr.type === "CallExpression" &&
        expr.callee.type === "Identifier" &&
        neverFunctions.has(expr.callee.name)
      ) {
        return true;
      }
      return false;
    }
    default:
      return false;
  }
}

function isNeverReturnType(node: TSESTree.TypeNode): boolean {
  return node.type === "TSNeverKeyword";
}

export default createRule({
  name: "no-never-reachable-endpoint",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow functions with return type `never` that have a reachable endpoint",
    },
    messages: {
      reachableEnd:
        "A function returning 'never' must not have a reachable endpoint. Every code path must throw, loop infinitely, or call another never-returning function. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T34-never-bottom.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"reachableEnd", []>) {
    const neverFunctions = new Set<string>();

    function checkFunctionBody(
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression,
    ): void {
      if (!node.body) return;

      if (node.body.type !== "BlockStatement") {
        context.report({ node, messageId: "reachableEnd" });
        return;
      }

      const { body } = node.body;
      if (body.length === 0) {
        context.report({ node, messageId: "reachableEnd" });
        return;
      }

      const lastStmt = body[body.length - 1];
      if (!isTerminating(lastStmt, neverFunctions)) {
        context.report({ node, messageId: "reachableEnd" });
      }
    }

    return {
      FunctionDeclaration(node) {
        const returnType = node.returnType?.typeAnnotation;
        if (
          node.id &&
          returnType &&
          isNeverReturnType(returnType)
        ) {
          neverFunctions.add(node.id.name);
        }
        checkFunctionBody(node);
      },
      FunctionExpression(node) {
        const returnType = node.returnType?.typeAnnotation;
        if (returnType && isNeverReturnType(returnType)) {
          const parent = node.parent;
          if (
            parent &&
            parent.type === "VariableDeclarator" &&
            parent.id.type === "Identifier"
          ) {
            neverFunctions.add(parent.id.name);
          }
        }
        checkFunctionBody(node);
      },
      ArrowFunctionExpression(node) {
        const returnType = node.returnType?.typeAnnotation;
        if (returnType && isNeverReturnType(returnType)) {
          const parent = node.parent;
          if (
            parent?.type === "VariableDeclarator" &&
            parent.id.type === "Identifier"
          ) {
            neverFunctions.add(parent.id.name);
          }
        }
        checkFunctionBody(node);
      },
    };
  },
});
