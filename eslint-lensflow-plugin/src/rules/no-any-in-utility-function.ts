import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

function getParamName(param: TSESTree.Parameter): string {
  if (param.type === "AssignmentPattern") {
    return param.left.type === "Identifier" ? param.left.name : "unnamed";
  }
  if (param.type === "Identifier") {
    return param.name;
  }
  return "unnamed";
}

function isParamAny(param: TSESTree.Parameter): boolean {
  if (param.type === "AssignmentPattern") {
    return param.left.typeAnnotation?.typeAnnotation.type === "TSAnyKeyword";
  }
  if (param.type === "Identifier") {
    return param.typeAnnotation?.typeAnnotation.type === "TSAnyKeyword";
  }
  return false;
}

export default createRule({
  name: "no-any-in-utility-function",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `any` in standalone utility function parameter or return types when a generic could preserve type safety",
    },
    messages: {
      anyParam:
        "Utility function uses `any` for parameter '{{name}}'. Use a generic type parameter to preserve type safety. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T04-generics-bounds.md",
      anyReturn:
        "Utility function uses `any` for return type. Use a generic type parameter to preserve type safety. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T04-generics-bounds.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"anyParam" | "anyReturn", []>) {
    function checkFunction(
      node: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression,
    ) {
      const parent = node.parent;
      if (
        parent?.type !== "Program" &&
        parent?.type !== "ExportNamedDeclaration"
      ) {
        return;
      }

      if (node.typeParameters) {
        return;
      }

      let anyParam: TSESTree.Parameter | null = null;

      for (const param of node.params) {
        if (isParamAny(param)) {
          anyParam = param;
          break;
        }
      }

      if (anyParam) {
        context.report({
          node,
          messageId: "anyParam",
          data: { name: getParamName(anyParam) },
        });
      }

      if (node.returnType?.typeAnnotation.type === "TSAnyKeyword") {
        context.report({
          node,
          messageId: "anyReturn",
        });
      }
    }

    return {
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
    };
  },
});
