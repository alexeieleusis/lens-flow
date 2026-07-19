import type { TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { containsAny } from "../utils/ts-helpers.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T31-record-types.md");

export default createRule({
  name: "no-any-index-signature",
  meta: {
    type: "problem",
    deprecated: true,
    replacedBy: ["no-broad-index-signatures"],
    docs: {
      description:
        "Disallow index signatures that use `any` as the value type, which loses all type safety for dynamically keyed properties.",
    },
    messages: {
      anyIndexSignature:
        "Index signature uses `any` as the value type, losing all type safety for dynamically keyed properties. Use a specific union type instead (e.g., `string | number | boolean`). See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"anyIndexSignature", []>) {
    return {
      TSIndexSignature(node) {
        const typeAnnotation = node.typeAnnotation?.typeAnnotation;
        if (typeAnnotation && containsAny(typeAnnotation)) {
          context.report({
            node,
            messageId: "anyIndexSignature",
            data: { url: URL },
          });
        }
      },
    };
  },
});
