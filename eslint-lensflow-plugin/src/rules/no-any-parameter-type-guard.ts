import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

const URL = knowledgeUrl("catalog/T61-recursive-types.md");

type FunctionLikeNode =
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression
  | TSESTree.ArrowFunctionExpression
  | TSESTree.TSDeclareFunction
  | TSESTree.TSFunctionType
  | TSESTree.MethodDefinition;

type ParamNode =
  | TSESTree.Identifier
  | TSESTree.AssignmentPattern
  | TSESTree.RestElement
  | TSESTree.ObjectPattern
  | TSESTree.ArrayPattern;

function isAnyParam(param: ParamNode): boolean {
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
  return param.typeAnnotation?.typeAnnotation?.type === "TSAnyKeyword";
}

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
        "Type guard function accepts `any` parameter. Rely on compile-time recursive types instead of runtime structural validation. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"anyParamWithTypeGuard", []>) {
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
            data: {
              url: URL,
            },
          });
        }
      }
    }

    return {
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction,
      TSDeclareFunction: checkFunction,
      TSFunctionType: checkFunction,
      MethodDefinition: checkFunction,
    };
  },
});
