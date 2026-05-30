import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "no-any-parameter-type-guard",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow type guard functions that accept `any` as a parameter type",
    },
    messages: {
      anyParamWithTypeGuard:
        "Type guard function accepts `any` parameter. Rely on compile-time recursive types instead of runtime structural validation. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T61-recursive-types.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"anyParamWithTypeGuard", []>) {
    function checkFunction(node: any) {
      const hasAnyParam = node.params.some((param: any) => {
        return (
          param.type === "Identifier" &&
          param.typeAnnotation?.typeAnnotation?.type === "TSAnyKeyword"
        );
      });

      const hasTypePredicate =
        node.returnType?.typeAnnotation?.type === "TSTypePredicate";

      if (hasAnyParam && hasTypePredicate) {
        context.report({
          node,
          messageId: "anyParamWithTypeGuard",
        });
      }
    }

    return {
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction,
    };
  },
});
