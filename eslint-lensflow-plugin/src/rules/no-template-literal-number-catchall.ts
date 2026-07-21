import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESLint } from "@typescript-eslint/utils";

const URL = knowledgeUrl("catalog/T63-template-literal-types.md");

export default createRule({
  name: "no-template-literal-number-catchall",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `${number}` or `${string}` as the sole interpolated type in a template literal type, which produces an overly permissive type.",
    },
    messages: {
      bareNumber:
        "Do not use `${number}` in a template literal type as it accepts any numeric string. Use an explicit union of literal strings instead. See: {{url}}",
      bareString:
        "Do not use `${string}` alongside more specific types in a template literal type. It dominates the union and makes other constraints meaningless. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"bareNumber" | "bareString", []>) {
    return {
      TSTemplateLiteralType(node) {
        const types = node.types;

        const hasMoreSpecificType = types.some(
          (t) => t.type !== "TSStringKeyword" && t.type !== "TSNumberKeyword",
        );

        for (const type of types) {
          if (type.type === "TSNumberKeyword") {
            context.report({
              node,
              messageId: "bareNumber",
              data: { url: URL },
            });
            return;
          }

          if (type.type === "TSStringKeyword" && hasMoreSpecificType) {
            context.report({
              node,
              messageId: "bareString",
              data: { url: URL },
            });
            return;
          }
        }
      },
    };
  },
});
