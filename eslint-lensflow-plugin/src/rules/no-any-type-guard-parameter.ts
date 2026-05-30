import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "no-any-type-guard-parameter",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow type guard functions that accept `any` instead of `unknown`",
    },
    messages: {
      anyTypeGuardParam:
        "Type guard parameter should be `unknown` not `any`. Using `any` bypasses narrowing even after the guard passes. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T47-gradual-typing.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"anyTypeGuardParam", []>) {
    return {
      FunctionDeclaration(node) {
        if (
          node.returnType?.typeAnnotation.type === "TSTypePredicate" &&
          node.params.length > 0
        ) {
          let firstParam = node.params[0];
          if (firstParam.type === "TSParameterProperty") {
            firstParam = firstParam.parameter;
          }
          if (
            firstParam.typeAnnotation?.typeAnnotation.type ===
            "TSAnyKeyword"
          ) {
            context.report({
              node,
              messageId: "anyTypeGuardParam",
            });
          }
        }
      },
      TSDeclareFunction(node) {
        if (
          node.returnType?.typeAnnotation.type === "TSTypePredicate" &&
          node.params.length > 0
        ) {
          let firstParam = node.params[0];
          if (firstParam.type === "TSParameterProperty") {
            firstParam = firstParam.parameter;
          }
          if (
            firstParam.typeAnnotation?.typeAnnotation.type ===
            "TSAnyKeyword"
          ) {
            context.report({
              node,
              messageId: "anyTypeGuardParam",
            });
          }
        }
      },
    };
  },
});
