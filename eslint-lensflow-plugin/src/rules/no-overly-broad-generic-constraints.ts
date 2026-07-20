import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";
import { containsAny } from "../utils/ts-helpers.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T49-associated-types.md");

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
        "Using `any` as a generic type argument removes type safety. Provide a concrete type instead. See: {{url}}",
      anyConstraint:
        "Using `any` as a type parameter constraint defeats the purpose of constraining. Use a meaningful bound instead. See: {{url}}",
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
            data: { url: URL },
          });
        }
      },

      TSTypeReference(node) {
        if (node.typeArguments) {
          for (const param of node.typeArguments.params) {
            if (containsAny(param)) {
              context.report({
                node: param,
                messageId: "anyTypeArg",
                data: { url: URL },
              });
            }
          }
        }
      },

      TSClassImplements(node) {
        if (node.typeArguments) {
          for (const param of node.typeArguments.params) {
            if (containsAny(param)) {
              context.report({
                node: param,
                messageId: "anyTypeArg",
                data: { url: URL },
              });
            }
          }
        }
      },
    };
  },
});
