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
    const activeNames = new Set<string>();

    function reportShadow(name: string, node: TSESTree.Node) {
      if (activeNames.has(name)) {
        context.report({ node, messageId: "shadowedTypeParam", data: { name } });
      }
    }

    function trackScope(names: string[]) {
      for (const name of names) activeNames.add(name);
      scopeStack.push(names);
    }

    function untrackScope() {
      const names = scopeStack.pop();
      if (names) {
        for (const name of names) activeNames.delete(name);
      }
    }

    function enterTypeParams(typeParams: TSESTree.TSTypeParameterDeclaration | undefined) {
      if (!typeParams || typeParams.params.length === 0) return;

      const params = typeParams.params;
      const names = params.map((p) => p.name.name);

      for (let i = 0; i < names.length; i++) {
        reportShadow(names[i], params[i]);
      }

      trackScope(names);
    }

    function exitTypeParams(typeParams: TSESTree.TSTypeParameterDeclaration | undefined) {
      if (typeParams && typeParams.params.length > 0) {
        untrackScope();
      }
    }

    function enterWithParams(
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression
        | TSESTree.ClassDeclaration
        | TSESTree.ClassExpression
        | TSESTree.TSDeclareFunction
        | TSESTree.TSInterfaceDeclaration
        | TSESTree.TSTypeAliasDeclaration
        | TSESTree.TSEmptyBodyFunctionExpression,
    ) {
      enterTypeParams(node.typeParameters);
    }

    function exitWithParams(
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression
        | TSESTree.ClassDeclaration
        | TSESTree.ClassExpression
        | TSESTree.TSDeclareFunction
        | TSESTree.TSInterfaceDeclaration
        | TSESTree.TSTypeAliasDeclaration
        | TSESTree.TSEmptyBodyFunctionExpression,
    ) {
      exitTypeParams(node.typeParameters);
    }

    function enterConditionalType(node: TSESTree.TSConditionalType) {
      enterTypeParams((node as { typeParameters?: TSESTree.TSTypeParameterDeclaration }).typeParameters);
    }

    function exitConditionalType(node: TSESTree.TSConditionalType) {
      exitTypeParams((node as { typeParameters?: TSESTree.TSTypeParameterDeclaration }).typeParameters);
    }

    function enterMappedType(node: TSESTree.TSMappedType) {
      const name = node.key.name;

      reportShadow(name, node.key);
      trackScope([name]);
    }

    function exitMappedType() {
      untrackScope();
    }

    function enterMethodSignature(node: TSESTree.TSMethodSignature) {
      enterTypeParams((node as { typeParameters?: TSESTree.TSTypeParameterDeclaration }).typeParameters);
    }

    function exitMethodSignature(node: TSESTree.TSMethodSignature) {
      exitTypeParams((node as { typeParameters?: TSESTree.TSTypeParameterDeclaration }).typeParameters);
    }

    function enterFunctionType(node: TSESTree.TSFunctionType) {
      enterTypeParams(node.typeParameters);
    }

    function exitFunctionType(node: TSESTree.TSFunctionType) {
      exitTypeParams(node.typeParameters);
    }

    function enterMethodDefinition(node: TSESTree.MethodDefinition) {
      enterTypeParams((node as { typeParameters?: TSESTree.TSTypeParameterDeclaration }).typeParameters);
    }

    function exitMethodDefinition(node: TSESTree.MethodDefinition) {
      exitTypeParams((node as { typeParameters?: TSESTree.TSTypeParameterDeclaration }).typeParameters);
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
      TSEmptyBodyFunctionExpression(node) {
        enterWithParams(node);
      },
      "TSEmptyBodyFunctionExpression:exit"(node) {
        exitWithParams(node);
      },
      TSInterfaceDeclaration(node) {
        enterWithParams(node);
      },
      "TSInterfaceDeclaration:exit"(node) {
        exitWithParams(node);
      },
      TSTypeAliasDeclaration(node) {
        enterWithParams(node);
      },
      "TSTypeAliasDeclaration:exit"(node) {
        exitWithParams(node);
      },
      TSConditionalType(node) {
        enterConditionalType(node);
      },
      "TSConditionalType:exit"(node) {
        exitConditionalType(node);
      },
      TSMappedType(node) {
        enterMappedType(node);
      },
      "TSMappedType:exit"() {
        exitMappedType();
      },
      TSMethodSignature(node) {
        enterMethodSignature(node);
      },
      "TSMethodSignature:exit"(node) {
        exitMethodSignature(node);
      },
      MethodDefinition(node) {
        enterMethodDefinition(node);
      },
      "MethodDefinition:exit"(node) {
        exitMethodDefinition(node);
      },
      TSFunctionType(node) {
        enterFunctionType(node);
      },
      "TSFunctionType:exit"(node) {
        exitFunctionType(node);
      },
    };
  },
});
