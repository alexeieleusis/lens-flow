import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";
import { containsAny } from "../utils/ts-helpers.js";

export default createRule({
  name: "no-overly-broad-generic-constraints",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow using `any` as a generic type argument or constraint, which weakens type safety.",
    },
    messages: {
      anyTypeArg:
        "Using `any` as a generic type argument removes type safety. Provide a concrete type instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T49-associated-types.md",
      anyConstraint:
        "Using `any` as a type parameter constraint defeats the purpose of constraining. Use a meaningful bound instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T49-associated-types.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"anyConstraint" | "anyTypeArg", []>) {
    return {
      TSTypeParameter(node) {
        if (node.constraint && containsAny(node.constraint)) {
          context.report({
            node: node.constraint,
            messageId: "anyConstraint",
          });
        }
      },

      TSTypeParameterInstantiation(node) {
        for (const param of node.params) {
          if (containsAny(param)) {
            context.report({
              node: param,
              messageId: "anyTypeArg",
            });
          }
        }
      },

      TSTypeReference(node) {
        if (node.typeArguments) {
          for (const param of node.typeArguments.params) {
            if (containsAny(param)) {
              context.report({
                node: param,
                messageId: "anyTypeArg",
              });
            }
          }
        }
      },
    };
  },
});
