import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESLint } from "@typescript-eslint/utils";

const URL = knowledgeUrl("catalog/T01-algebraic-data-types.md");

export default createRule({
  name: "no-kitchen-sink-variant",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Flag union type-literal variants with too many top-level fields",
    },
    messages: {
      tooManyFields:
        "Union variant has {{count}} fields (max {{max}}). Extract into a nested type. See: {{url}}",
    },
    schema: [
      {
        type: "object",
        properties: {
          maxFields: {
            type: "number",
            minimum: 1,
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
  },
  defaultOptions: [{ maxFields: 6 }],
  create(
    context: TSESLint.RuleContext<"tooManyFields", [{ maxFields?: number }]>,
  ) {
    const { maxFields = 6 } = context.options[0] ?? { maxFields: 6 };

    return {
      TSTypeLiteral(node) {
        const ancestors = context.sourceCode.getAncestors(node);
        const parent = ancestors[ancestors.length - 1];
        if (parent?.type !== "TSUnionType") return;

        const properties = node.members.filter(
          (member) => member.type === "TSPropertySignature",
        );

        const hasDataProperty = properties.some((p) => {
          let name: string | null = null;
          if (p.key.type === "Identifier") {
            name = p.key.name;
          } else if (p.key.type === "Literal") {
            name = String(p.key.value);
          }
          return name === "data";
        });

        if (properties.length > maxFields && !hasDataProperty) {
          context.report({
            node,
            messageId: "tooManyFields",
            data: {
              count: String(properties.length),
              max: String(maxFields),
              url: URL,
            },
          });
        }
      },
    };
  },
});
