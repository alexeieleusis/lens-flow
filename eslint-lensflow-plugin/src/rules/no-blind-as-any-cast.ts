import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

export default createRule({
  name: "no-blind-as-any-cast",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow bare `as any` casts in function returns without preceding runtime validation",
    },
    messages: {
      blindAsAnyCast:
        "Returning a bare `as any` cast without runtime validation makes the type assertion an unchecked lie. Add a guard check before the cast, or use `as unknown as TargetType` instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/usecases/UC13-state-machines.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"blindAsAnyCast", []>) {
    function containsEarlyExitOrBlock(node: TSESTree.Node): boolean {
      if (
        node.type === "ThrowStatement" ||
        node.type === "ReturnStatement" ||
        node.type === "WhileStatement" ||
        node.type === "ForStatement" ||
        node.type === "DoWhileStatement"
      ) {
        return true;
      }
      if (node.type === "BlockStatement") {
        return node.body.some(containsEarlyExitOrBlock);
      }
      if (node.type === "IfStatement") {
        return (
          containsEarlyExitOrBlock(node.consequent) ||
          (node.alternate ? containsEarlyExitOrBlock(node.alternate) : false)
        );
      }
      if (node.type === "LabeledStatement") {
        return containsEarlyExitOrBlock(node.body);
      }
      if (node.type === "WithStatement") {
        return containsEarlyExitOrBlock(node.body);
      }
      if (node.type === "SwitchStatement") {
        return node.cases.some((c) =>
          c.consequent.some(containsEarlyExitOrBlock),
        );
      }
      return false;
    }

    function isGuardIf(node: TSESTree.Node): node is TSESTree.IfStatement {
      return (
        node.type === "IfStatement" && containsEarlyExitOrBlock(node.consequent)
      );
    }

    function checkFunctionBody(body: TSESTree.BlockStatement) {
      for (let i = 0; i < body.body.length; i++) {
        const stmt = body.body[i];
        if (stmt.type !== "ReturnStatement" || !stmt.argument) continue;

        const arg = stmt.argument;
        if (
          arg.type === "TSAsExpression" &&
          arg.typeAnnotation.type === "TSAnyKeyword"
        ) {
          const hasValidation = body.body.slice(0, i).some(
            (s) => s.type === "ThrowStatement" || isGuardIf(s),
          );
          if (!hasValidation) {
            context.report({
              node: arg,
              messageId: "blindAsAnyCast",
            });
          }
        }
      }
    }

    return {
      FunctionDeclaration(node) {
        checkFunctionBody(node.body);
      },
      FunctionExpression(node) {
        checkFunctionBody(node.body);
      },
      ArrowFunctionExpression(node) {
        if (node.body.type === "BlockStatement") {
          checkFunctionBody(node.body);
        } else if (
          node.body.type === "TSAsExpression" &&
          node.body.typeAnnotation.type === "TSAnyKeyword"
        ) {
          context.report({
            node: node.body,
            messageId: "blindAsAnyCast",
          });
        }
      },
    };
  },
});
