import { createRule } from "../utils/rule-creator.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

export default createRule({
  name: "no-runtime-init-guard",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow runtime null/falsy checks with throw to enforce required initialization; use typestate instead",
    },
    messages: {
      runtimeInitGuard:
        "Runtime null check with throw to enforce initialization should be a compile-time type error via typestate. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T57-typestate.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"runtimeInitGuard", []>) {
    return {
      IfStatement(node) {
        const ancestors = context.sourceCode.getAncestors(node);
        let isInsideMethod = false;
        for (const a of ancestors) {
          if (
            a.type === "FunctionDeclaration" ||
            a.type === "FunctionExpression" ||
            a.type === "ArrowFunctionExpression"
          )
            break;
          if (a.type === "MethodDefinition") {
            isInsideMethod = true;
            break;
          }
          if (
            a.type === "PropertyDefinition" &&
            (a.value?.type === "ArrowFunctionExpression" ||
              a.value?.type === "FunctionExpression")
          ) {
            isInsideMethod = true;
            break;
          }
        }
        if (!isInsideMethod) return;

        let throwStmt: TSESTree.ThrowStatement | null = null;
        let throwInAlternate = false;

        if (node.consequent.type === "ThrowStatement") {
          throwStmt = node.consequent;
        } else if (node.alternate) {
          if (node.alternate.type === "ThrowStatement") {
            throwStmt = node.alternate;
            throwInAlternate = true;
          } else if (
            node.alternate.type === "BlockStatement" &&
            node.alternate.body.length === 1 &&
            node.alternate.body[0].type === "ThrowStatement"
          ) {
            throwStmt = node.alternate.body[0];
            throwInAlternate = true;
          }
        }

        if (!throwStmt) return;

        const thrown = throwStmt.argument;
        if (thrown?.type !== "NewExpression") return;

        const callee = thrown.callee;
        if (callee.type !== "Identifier" || !/^Error$/.test(callee.name))
          return;

        let target: TSESTree.Node;
        if (node.test.type === "UnaryExpression" && node.test.operator === "!") {
          target = node.test.argument;
        } else if (throwInAlternate && node.test.type === "MemberExpression") {
          target = node.test;
        } else {
          return;
        }

        if (target.type !== "MemberExpression") return;
        if (target.object.type !== "ThisExpression") return;

        context.report({ node, messageId: "runtimeInitGuard" });
      },
    };
  },
});
