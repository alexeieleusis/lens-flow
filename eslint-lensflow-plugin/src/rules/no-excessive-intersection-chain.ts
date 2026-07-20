import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESLint } from "@typescript-eslint/utils";

const URL = knowledgeUrl("catalog/T02-union-intersection.md");

export default createRule({
  name: "no-excessive-intersection-chain",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow intersection type chains with too many members",
    },
    messages: {
      excessiveChain:
        "Intersection type has {{count}} members which exceeds the maximum of {{max}}. Decompose into intermediate type aliases for readability. See: {{url}}",
    },
    schema: [
      {
        type: "object",
        properties: {
          maxMembers: {
            type: "number",
            minimum: 2,
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
  },
  defaultOptions: [{ maxMembers: 4 }],
  create(context: TSESLint.RuleContext<"excessiveChain", [{ maxMembers: number }]>) {
    const options = context.options[0] ?? { maxMembers: 4 };

    return {
      TSIntersectionType(node) {
        if (node.types.length > options.maxMembers) {
          context.report({
            node,
            messageId: "excessiveChain",
            data: {
              count: String(node.types.length),
              max: String(options.maxMembers),
              url: URL,
            },
          });
        }
      },
    };
  },
});
