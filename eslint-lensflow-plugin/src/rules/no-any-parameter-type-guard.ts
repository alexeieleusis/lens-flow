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
        "Type guard function accepts `any` parameter. Rely on compile-time recursive types instead of runtime structural validation. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T61-recursive-types.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"anyParamWithTypeGuard", []>) {
    function hasAnyParam(params: any[]): boolean {
      return params.some((param: any) => {
        return isAnyParam(param);
      });
    }

    function isAnyParam(param: any): boolean {
      // RestElement, ObjectPattern, ArrayPattern: typeAnnotation is on the node itself
      if (
        param.type === "RestElement" ||
        param.type === "ObjectPattern" ||
        param.type === "ArrayPattern"
      ) {
        return param.typeAnnotation?.typeAnnotation?.type === "TSAnyKeyword";
      }

      // AssignmentPattern: unwrap to .left
      if (param.type === "AssignmentPattern") {
        return isAnyParam(param.left);
      }

      // Identifier: check directly
      if (param.type === "Identifier") {
        return param.typeAnnotation?.typeAnnotation?.type === "TSAnyKeyword";
      }

      return false;
    }

    function checkFunction(node: any) {
      const params = node.params || [];

      const hasTypePredicate =
        node.returnType?.typeAnnotation?.type === "TSTypePredicate";

      if (!hasTypePredicate) return;

      for (const param of params) {
        if (isAnyParam(param)) {
          context.report({
            node: param,
            messageId: "anyParamWithTypeGuard",
          });
        }
      }
    }

    return {
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction,
      TSDeclareFunction: checkFunction,
    };
  },
});
