import { AST_NODE_TYPES, TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

function getTypeName(node: TSESTree.TSTypeReference): string | null {
  if (node.typeName.type === AST_NODE_TYPES.Identifier) {
    return node.typeName.name;
  }
  return null;
}

function getReturnType(
  node: TSESTree.TSMethodSignature | TSESTree.TSPropertySignature,
): TSESTree.TSTypeReference | null {
  if (node.type === AST_NODE_TYPES.TSMethodSignature) {
    const rt = node.returnType?.typeAnnotation;
    return rt?.type === AST_NODE_TYPES.TSTypeReference ? rt : null;
  }

  if (node.type === AST_NODE_TYPES.TSPropertySignature) {
    const ta = node.typeAnnotation?.typeAnnotation;
    if (
      ta?.type === AST_NODE_TYPES.TSFunctionType ||
      ta?.type === AST_NODE_TYPES.TSConstructorType
    ) {
      const rt = ta.returnType?.typeAnnotation;
      return rt?.type === AST_NODE_TYPES.TSTypeReference ? rt : null;
    }
  }

  return null;
}

export default createRule({
  name: "prefer-this-interface-return",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer `this` as return type over the interface's own name in interface method signatures",
    },
    messages: {
      preferThis:
        "Interface method returns the interface's own type ({{interfaceName}}). Use `this` instead to preserve concrete subclass type on calls. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T33-self-type.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"preferThis", []>) {
    return {
      TSInterfaceDeclaration(node) {
        if (!node.id) return;
        const interfaceName = node.id.name;

        if (node.body.type !== AST_NODE_TYPES.TSInterfaceBody) return;

        for (const member of node.body.body) {
          if (
            member.type !== AST_NODE_TYPES.TSMethodSignature &&
            member.type !== AST_NODE_TYPES.TSPropertySignature
          )
            continue;

          const returnType = getReturnType(member);
          if (!returnType) continue;

          const typeName = getTypeName(returnType);
          if (typeName === interfaceName) {
            context.report({
              node: returnType,
              messageId: "preferThis",
              data: { interfaceName },
            });
          }
        }
      },
    };
  },
});
