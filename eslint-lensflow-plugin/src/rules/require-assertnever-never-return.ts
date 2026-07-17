import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

function getActualTypeName(
  node: TSESTree.TypeNode,
  sourceCode: TSESLint.SourceCode,
): string {
  if (node.type === "TSStringKeyword") return "string";
  if (node.type === "TSNumberKeyword") return "number";
  if (node.type === "TSBooleanKeyword") return "boolean";
  if (node.type === "TSAnyKeyword") return "any";
  if (node.type === "TSUnknownKeyword") return "unknown";
  if (node.type === "TSVoidKeyword") return "void";
  if (node.type === "TSNullKeyword") return "null";
  if (node.type === "TSUndefinedKeyword") return "undefined";
  return sourceCode.getText(node);
}

function getArrowFunctionName(node: TSESTree.ArrowFunctionExpression): string | null {
  const parent = node.parent;
  if (!parent) return null;

  if (parent.type === "VariableDeclarator" && parent.id.type === "Identifier") {
    return parent.id.name;
  }
  if (parent.type === "PropertyDefinition" && parent.key.type === "Identifier") {
    return parent.key.name;
  }
  if (parent.type === "Property" && parent.key.type === "Identifier") {
    return parent.key.name;
  }
  return null;
}

export default createRule({
  name: "require-assertnever-never-return",
  meta: {
    type: "problem",
    docs: {
      description:
        "Enforce that assertNever and assertExhaustive functions return the `never` type",
    },
    messages: {
      missingNeverReturn:
        "The `{{name}}` function must return `never` to satisfy control flow in exhaustive switch statements. Add a `: never` return type annotation. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T34-never-bottom.md",
      wrongReturnType:
        "The `{{name}}` function returns `{{actual}}` but must return `never`. Change the return type to `never`. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T34-never-bottom.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"missingNeverReturn" | "wrongReturnType", []>) {
    const namePattern = /^(?:assertNever|assertExhaustive)$/;

    function reportMissingNeverReturn(
      node: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression | TSESTree.TSDeclareFunction,
      funcName: string,
    ) {
      const returnType = node.returnType?.typeAnnotation;

      if (!returnType) {
        context.report({
          node,
          messageId: "missingNeverReturn",
          data: { name: funcName },
        });
      } else if (returnType.type !== "TSNeverKeyword") {
        context.report({
          node,
          messageId: "wrongReturnType",
          data: { name: funcName, actual: getActualTypeName(returnType, context.sourceCode) },
        });
      }
    }

    function checkFunction(node: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.TSDeclareFunction) {
      const funcName = node.id?.name;

      if (!funcName || !namePattern.test(funcName)) return;

      const returnType = node.returnType?.typeAnnotation;

      if (!returnType) {
        context.report({
          node,
          messageId: "missingNeverReturn",
          data: { name: funcName },
        });
      } else if (returnType.type !== "TSNeverKeyword") {
        context.report({
          node,
          messageId: "wrongReturnType",
          data: { name: funcName, actual: getActualTypeName(returnType, context.sourceCode) },
        });
      }
    }

    function getArrowFunctionName(node: TSESTree.ArrowFunctionExpression): string | null {
      const parent = node.parent;
      if (!parent) return null;

      if (parent.type === "VariableDeclarator" && parent.id.type === "Identifier") {
        return parent.id.name;
      }
      if (parent.type === "PropertyDefinition" && parent.key.type === "Identifier") {
        return parent.key.name;
      }
      if (parent.type === "Property" && parent.key.type === "Identifier") {
        return parent.key.name;
      }
      return null;
    }

    return {
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      TSDeclareFunction: checkFunction,
      ArrowFunctionExpression(node) {
        const funcName = getArrowFunctionName(node);
        if (!funcName || !namePattern.test(funcName)) return;

        reportMissingNeverReturn(node, funcName);
      },
    };
  },
});
