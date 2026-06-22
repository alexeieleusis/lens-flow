import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

const KNOWNledge_URL =
  "https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T04-generics-bounds.md";

export default createRule({
  name: "no-shadowed-type-parameter",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow nested generic declarations that shadow an outer type parameter name.",
    },
    messages: {
      shadowedTypeParam:
        "Type parameter '{{name}}' shadows an outer type parameter of the same name. Rename it to a distinct identifier. See: " +
        KNOWNledge_URL,
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"shadowedTypeParam", []>) {
    const scopeStack: string[][] = [];

    function enterWithParams(
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression
        | TSESTree.ClassDeclaration
        | TSESTree.ClassExpression
        | TSESTree.TSDeclareFunction,
    ) {
      const typeParams = node.typeParameters;
      if (!typeParams || typeParams.params.length === 0) return;

      const names = typeParams.params.map((p) => p.name.name);
      const outerNames = new Set(scopeStack.flat());

      for (let i = 0; i < names.length; i++) {
        if (outerNames.has(names[i])) {
          context.report({
            node: typeParams.params[i],
            messageId: "shadowedTypeParam",
            data: { name: names[i] },
          });
        }
      }

      scopeStack.push(names);
    }

    function exitWithParams(
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression
        | TSESTree.ClassDeclaration
        | TSESTree.ClassExpression
        | TSESTree.TSDeclareFunction,
    ) {
      if (node.typeParameters && node.typeParameters.params.length > 0) {
        scopeStack.pop();
      }
    }

    return {
      FunctionDeclaration(node) {
        enterWithParams(node);
      },
      "FunctionDeclaration:exit"(node) {
        exitWithParams(node);
      },
      FunctionExpression(node) {
        enterWithParams(node);
      },
      "FunctionExpression:exit"(node) {
        exitWithParams(node);
      },
      ArrowFunctionExpression(node) {
        enterWithParams(node);
      },
      "ArrowFunctionExpression:exit"(node) {
        exitWithParams(node);
      },
      ClassDeclaration(node) {
        enterWithParams(node);
      },
      "ClassDeclaration:exit"(node) {
        exitWithParams(node);
      },
      ClassExpression(node) {
        enterWithParams(node);
      },
      "ClassExpression:exit"(node) {
        exitWithParams(node);
      },
      TSDeclareFunction(node) {
        enterWithParams(node);
      },
      "TSDeclareFunction:exit"(node) {
        exitWithParams(node);
      },
    };
  },
});
