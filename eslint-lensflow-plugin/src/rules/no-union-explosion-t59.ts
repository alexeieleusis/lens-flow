import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "no-union-explosion-t59",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Discriminated unions with too many variants break easily when new variants are added",
    },
    messages: {
      tooManyVariants:
        "Union has {{count}} variants (max: {{max}}). Consider using an interface with a render() method instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T59-existential-types.md",
    },
    schema: [
      {
        type: "object",
        properties: {
          maxVariants: {
            type: "number",
            minimum: 2,
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
  },
  defaultOptions: [{ maxVariants: 5 }],
  create(context: TSESLint.RuleContext<"tooManyVariants", [{ maxVariants: number }]>) {
    const [{ maxVariants } = { maxVariants: 5 }] = context.options ?? [];

    return {
      TSUnionType(node) {
        const members = node.types;
        const objectLike = members.filter(
          (m) => m.type === "TSTypeLiteral" || m.type === "TSTypeReference",
        );
        if (objectLike.length > maxVariants && objectLike.length === members.length) {
          context.report({
            node,
            messageId: "tooManyVariants",
            data: {
              count: String(objectLike.length),
              max: String(maxVariants),
            },
          });
        }
      },
    };
  },
});
