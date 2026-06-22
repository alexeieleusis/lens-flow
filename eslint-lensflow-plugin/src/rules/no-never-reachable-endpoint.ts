import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

function isLiteralTrue(node: TSESTree.Expression | null | undefined): boolean {
  return node?.type === "Literal" && node.value === true;
}

function isTerminating(stmt: TSESTree.Statement): boolean {
  switch (stmt.type) {
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
      return isTerminating(stmt.consequent) && isTerminating(stmt.alternate);
    case "SwitchStatement": {
      const hasDefault = stmt.cases.some((c) => c.test === null);
      if (!hasDefault) return false;
      const cases = stmt.cases;
      const caseTerminates = cases.map((c) => {
        const last = c.consequent[c.consequent.length - 1];
        return last ? isTerminating(last) : false;
      });
      let nextTerminates = false;
      for (let i = cases.length - 1; i >= 0; i--) {
        if (!caseTerminates[i] && !nextTerminates) return false;
        nextTerminates = caseTerminates[i] || nextTerminates;
      }
      return true;
    }
    case "LabeledStatement":
      return isTerminating(stmt.body);
    case "BlockStatement": {
      const last = stmt.body[stmt.body.length - 1];
      return last ? isTerminating(last) : false;
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
        "A function returning 'never' must not have a reachable endpoint. Every code path must throw, loop infinitely, or call another never-returning function. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T34-never-bottom.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"reachableEnd", []>) {
    function checkFunction(
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression,
    ): void {
      const returnType = node.returnType?.typeAnnotation;
      if (!returnType || !isNeverReturnType(returnType)) return;

      if (!node.body) return;

      if (node.body.type !== "BlockStatement") return;

      const { body } = node.body;
      if (body.length === 0) {
        context.report({ node, messageId: "reachableEnd" });
        return;
      }

      const lastStmt = body[body.length - 1];
      if (!isTerminating(lastStmt)) {
        context.report({ node, messageId: "reachableEnd" });
      }
    }

    return {
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction,
    };
  },
});
