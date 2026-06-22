import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "no-excessive-union-members",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow union types with too many non-literal members (e.g. primitive types, custom types, generic types). Literal-only unions are covered by no-large-literal-union",
    },
    messages: {
      tooManyMembers:
        "Union type has {{count}} members (max: {{max}}). Consider grouping related variants or using an interface dispatch for large open sets. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T36-trait-objects.md",
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
  defaultOptions: [{ maxMembers: 50 }],
  create(context: TSESLint.RuleContext<"tooManyMembers", [{ maxMembers: number }]>) {
    const { maxMembers } = context.options[0] ?? { maxMembers: 50 };

    return {
      TSUnionType(node) {
        const nonLiteralMembers = node.types.filter(
          (member) => member.type !== "TSLiteralType",
        );

        if (nonLiteralMembers.length > maxMembers) {
          context.report({
            node,
            messageId: "tooManyMembers",
            data: {
              count: String(nonLiteralMembers.length),
              max: String(maxMembers),
            },
          });
        }
      },
    };
  },
});
