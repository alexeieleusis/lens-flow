import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

function containsAnyKeyword(node: TSESTree.TypeNode): TSESTree.TSAnyKeyword | null {
  if (node.type === "TSAnyKeyword") return node;
  if (node.type === "TSArrayType") {
    return containsAnyKeyword(node.elementType);
  }
  if (node.type === "TSTypeReference") {
    const name = node.typeName;
    if (
      name.type === "Identifier" &&
      (name.name === "Array" || name.name === "ReadonlyArray")
    ) {
      const typeParams = node.typeArguments?.params;
      if (typeParams) {
        for (const tp of typeParams) {
          const found = containsAnyKeyword(tp);
          if (found) return found;
        }
      }
    }
  }
  return null;
}

export default createRule({
  name: "no-any-domain-parameter-uc02",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow function parameters typed as `any` instead of a typed domain shape",
    },
    messages: {
      anyParam:
        "Function parameter '{{name}}' is typed as `any`. Use a typed domain shape instead of `any` to ensure compile-time structure checking. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC02-domain-modeling.md",
      anyArrayParam:
        "Function parameter '{{name}}' is typed as `any[]`. Use a typed array like `Item[]` instead of `any[]` to ensure compile-time structure checking. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC02-domain-modeling.md",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"anyParam" | "anyArrayParam", []>) {
    function checkFunctionNode(
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression,
    ) {
      for (const param of node.params) {
        if (
          param.type === "Identifier" &&
          param.typeAnnotation?.typeAnnotation
        ) {
          const anyNode = containsAnyKeyword(
            param.typeAnnotation.typeAnnotation,
          );
          if (anyNode) {
            const parentType = param.typeAnnotation.typeAnnotation.type;
            context.report({
              node: anyNode,
              messageId:
                parentType === "TSArrayType" ? "anyArrayParam" : "anyParam",
              data: {
                name: param.name,
              },
            });
          }
        }
      }
    }

    return {
      FunctionDeclaration: checkFunctionNode,
      FunctionExpression: checkFunctionNode,
      ArrowFunctionExpression: checkFunctionNode,
    };
  },
});
