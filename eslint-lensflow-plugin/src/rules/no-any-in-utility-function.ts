import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

function getParamName(param: TSESTree.Parameter): string {
  if (param.type === "TSParameterProperty") {
    return getParamName(param.parameter);
  }
  if (param.type === "AssignmentPattern") {
    return param.left.type === "Identifier" ? param.left.name : "unnamed";
  }
  if (param.type === "Identifier") {
    return param.name;
  }
  if (param.type === "RestElement") {
    return param.argument.type === "Identifier" ? param.argument.name : "unnamed";
  }
  return "unnamed";
}

function isParamAny(param: TSESTree.Parameter): boolean {
  if (param.type === "TSParameterProperty") {
    return isParamAny(param.parameter);
  }
  if (param.type === "AssignmentPattern") {
    return param.left.typeAnnotation?.typeAnnotation.type === "TSAnyKeyword";
  }
  if (param.type === "Identifier") {
    return param.typeAnnotation?.typeAnnotation.type === "TSAnyKeyword";
  }
  if (
    param.type === "RestElement" ||
    param.type === "ObjectPattern" ||
    param.type === "ArrayPattern"
  ) {
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
        "Utility function uses `any` for parameter '{{name}}'. Use a generic type parameter to preserve type safety. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T04-generics-bounds.md",
      anyReturn:
        "Utility function uses `any` for return type. Use a generic type parameter to preserve type safety. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T04-generics-bounds.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"anyParam" | "anyReturn", []>) {
    function isStandalone(node: TSESTree.Node) {
      const parent = node.parent;
      if (!parent) return false;

      // Top-level: `function foo() {}` or `export function foo() {}`
      if (parent.type === "Program" || parent.type === "ExportNamedDeclaration") {
        return true;
      }

      // export default function foo() {}
      if (parent.type === "ExportDefaultDeclaration") {
        return true;
      }

      // `const foo = function() {}` / `const foo = () => {}`
      if (parent.type === "VariableDeclarator") {
        const decl = parent.parent;
        if (decl?.type === "VariableDeclaration") {
          const scope = decl.parent;
          return (
            scope?.type === "Program" ||
            scope?.type === "ExportNamedDeclaration"
          );
        }
      }

      return false;
    }

    function checkFunction(
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression,
    ) {
      if (!isStandalone(node)) {
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
      ArrowFunctionExpression: checkFunction,
    };
  },
});
