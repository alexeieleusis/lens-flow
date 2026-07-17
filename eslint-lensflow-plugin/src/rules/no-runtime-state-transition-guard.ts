import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "no-runtime-state-transition-guard",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow runtime state transition guards that use inequality checks with throws instead of typestate-based compile-time enforcement",
    },
    messages: {
      runtimeStateGuard:
        "Runtime state guard using `{{prop}} !== {{expected}}` with throw. Use typestate pattern for compile-time enforcement instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T57-typestate.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"runtimeStateGuard", []>) {
    let functionDepth = 0;

    return {
      FunctionExpression() {
        functionDepth++;
      },
      "FunctionExpression:exit"() {
        functionDepth--;
      },
      ArrowFunctionExpression() {
        functionDepth++;
      },
      "ArrowFunctionExpression:exit"() {
        functionDepth--;
      },
      FunctionDeclaration() {
        functionDepth++;
      },
      "FunctionDeclaration:exit"() {
        functionDepth--;
      },
      IfStatement(node) {
        if (functionDepth !== 1) return;
        if (node.test.type !== "BinaryExpression") return;
        const { left, right, operator } = node.test;
        if (operator !== "!=" && operator !== "!==") return;
        if (node.consequent.type !== "ThrowStatement") return;

        let thisMember = null;
        if (left.type === "MemberExpression" && left.object.type === "ThisExpression") {
          thisMember = left;
        } else if (right.type === "MemberExpression" && right.object.type === "ThisExpression") {
          thisMember = right;
        }
        if (!thisMember) return;

        const literal = thisMember === left ? right : left;
        if (literal.type !== "Literal" || typeof literal.value !== "string")
          return;

        let propName: string;
        if (thisMember.property.type === "Identifier") {
          propName = thisMember.property.name;
        } else if (thisMember.property.type === "Literal") {
          propName = String(thisMember.property.value);
        } else {
          propName = "?";
        }

        context.report({
          node,
          messageId: "runtimeStateGuard",
          data: {
            prop: propName,
            expected: String(literal.value),
          },
        });
      },
    };
  },
});
