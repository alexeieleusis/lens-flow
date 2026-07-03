import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

function containsAnyKeyword(node: TSESTree.TypeNode): TSESTree.TSAnyKeyword | null {
  if (node.type === "TSAnyKeyword") return node;
  if (node.type === "TSArrayType") {
    return containsAnyKeyword(node.elementType);
  }
  if (node.type === "TSUnionType") {
    for (const unionType of node.types) {
      const found = containsAnyKeyword(unionType);
      if (found) return found;
    }
    return null;
  }
  if (node.type === "TSIntersectionType") {
    for (const intersectionType of node.types) {
      const found = containsAnyKeyword(intersectionType);
      if (found) return found;
    }
    return null;
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
    function extractTypeInfo(
      param: TSESTree.Parameter,
    ): { name: string; typeAnnotation: TSESTree.TypeNode } | null {
      if (param.type === "Identifier") {
        if (param.typeAnnotation?.typeAnnotation) {
          return {
            name: param.name,
            typeAnnotation: param.typeAnnotation.typeAnnotation,
          };
        }
        return null;
      }

      if (param.type === "AssignmentPattern") {
        const left = param.left;
        if (
          left.type === "Identifier" &&
          left.typeAnnotation?.typeAnnotation
        ) {
          return {
            name: left.name,
            typeAnnotation: left.typeAnnotation.typeAnnotation,
          };
        }
        if (
          (left.type === "ObjectPattern" || left.type === "ArrayPattern") &&
          left.typeAnnotation?.typeAnnotation
        ) {
          return {
            name: "(destructured)",
            typeAnnotation: left.typeAnnotation.typeAnnotation,
          };
        }
        return null;
      }

      if (param.type === "RestElement") {
        const arg = param.argument;

        if (param.typeAnnotation?.typeAnnotation) {
          return {
            name:
              arg.type === "Identifier"
                ? arg.name
                : "(destructured)",
            typeAnnotation: param.typeAnnotation.typeAnnotation,
          };
        }

        if (
          (arg.type === "ObjectPattern" || arg.type === "ArrayPattern") &&
          arg.typeAnnotation?.typeAnnotation
        ) {
          return {
            name: "(destructured)",
            typeAnnotation: arg.typeAnnotation.typeAnnotation,
          };
        }
        return null;
      }

      if (param.type === "TSParameterProperty") {
        return extractTypeInfo(param.parameter);
      }

      if (
        param.type === "ObjectPattern" ||
        param.type === "ArrayPattern"
      ) {
        if (param.typeAnnotation?.typeAnnotation) {
          return {
            name: "(destructured)",
            typeAnnotation: param.typeAnnotation.typeAnnotation,
          };
        }
        return null;
      }

      return null;
    }

    function checkFunctionNode(
      node: { params: TSESTree.Parameter[] },
    ) {
      for (const param of node.params) {
        const info = extractTypeInfo(param);
        if (!info) continue;

        const anyNode = containsAnyKeyword(info.typeAnnotation);
        if (anyNode) {
          const parentType = info.typeAnnotation.type;
          context.report({
            node: anyNode,
            messageId:
              parentType === "TSArrayType" ? "anyArrayParam" : "anyParam",
            data: {
              name: info.name,
            },
          });
        }
      }
    }

    return {
      FunctionDeclaration: checkFunctionNode,
      FunctionExpression: checkFunctionNode,
      ArrowFunctionExpression: checkFunctionNode,
      TSDeclareFunction: checkFunctionNode,
      TSFunctionType: checkFunctionNode,
      TSMethodSignature: checkFunctionNode,
    };
  },
});
