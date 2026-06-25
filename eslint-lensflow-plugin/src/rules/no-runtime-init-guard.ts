import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

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
        }
        if (!isInsideMethod) return;

        const test = node.test;
        if (test.type !== "UnaryExpression") return;
        if (test.operator !== "!") return;

        const arg = test.argument;
        if (arg.type !== "MemberExpression") return;
        if (arg.object.type !== "ThisExpression") return;

        const consequent = node.consequent;
        if (consequent.type !== "ThrowStatement") return;

        const thrown = consequent.argument;
        if (thrown?.type !== "NewExpression") return;

        const callee = thrown.callee;
        if (callee.type !== "Identifier" || !/^Error$/.test(callee.name))
          return;

        context.report({ node, messageId: "runtimeInitGuard" });
      },
    };
  },
});
