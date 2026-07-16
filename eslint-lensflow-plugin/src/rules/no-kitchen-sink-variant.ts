import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

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
        "Union variant has {{count}} fields (max {{max}}). Extract into a nested type. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T01-algebraic-data-types.md",
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
  create(context: TSESLint.RuleContext<"tooManyFields", [{ maxFields?: number }]>) {
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
            },
          });
        }
      },
    };
  },
});
