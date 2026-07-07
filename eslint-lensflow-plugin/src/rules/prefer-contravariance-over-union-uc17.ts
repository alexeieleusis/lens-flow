import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

export default createRule({
  name: "prefer-contravariance-over-union-uc17",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer contravariant generics over union types in handler interface parameters",
    },
    messages: {
      preferContravariance:
        "Handler parameter uses a union type ({{types}}) instead of a contravariant generic `<in T>`. Refactor the interface to accept a generic type parameter for polymorphic assignment. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC17-variance.md",
    },
    schema: [
      {
        type: "object",
        properties: {
          minUnionMembers: {
            type: "number",
            minimum: 2,
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
  },
  defaultOptions: [{ minUnionMembers: 3 }],
  create(context: TSESLint.RuleContext<"preferContravariance", [{ minUnionMembers: number }]>) {
    const { minUnionMembers = 3 } = context.options[0] ?? {};

    function unwrapType(node: TSESTree.TypeNode): TSESTree.TypeNode {
      return node;
    }

    function checkFunctionParams(funcNode: TSESTree.TSFunctionType) {
      for (const param of funcNode.params) {
        if (param.type !== "Identifier") continue;
        const typeAnn = param.typeAnnotation?.typeAnnotation;
        if (!typeAnn) continue;
        if (typeAnn.type === "TSUnionType" && typeAnn.types.length >= minUnionMembers) {
          const typeNames = typeAnn.types
            .map((t: TSESTree.TypeNode) => {
              if (t.type === "TSTypeReference") {
                return t.typeName.type === "Identifier" ? t.typeName.name : "(complex-type)";
              }
              return "(unknown-type)";
            })
            .join(" | ");
          context.report({
            node: typeAnn,
            messageId: "preferContravariance",
            data: { types: typeNames },
          });
        }
      }
    }

    return {
      TSInterfaceBody(node) {
        for (const member of node.body) {
          if (
            member.type === "TSPropertySignature" &&
            member.typeAnnotation?.typeAnnotation?.type === "TSFunctionType"
          ) {
            checkFunctionParams(member.typeAnnotation.typeAnnotation);
          }
        }
      },

      TSTypeLiteral(node) {
        for (const member of node.members) {
          if (
            member.type === "TSPropertySignature" &&
            member.typeAnnotation?.typeAnnotation?.type === "TSFunctionType"
          ) {
            checkFunctionParams(member.typeAnnotation.typeAnnotation);
          }
        }
      },
    };
  },
});
