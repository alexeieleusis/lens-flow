import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "no-excessive-union-members",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow union types with too many members that can slow the TypeScript type checker",
    },
    messages: {
      tooManyMembers:
        "Union type has {{count}} members (max: {{max}}). Consider grouping related variants or using an interface dispatch for large open sets. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T36-trait-objects.md",
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
        if (node.types.length >= maxMembers) {
          context.report({
            node,
            messageId: "tooManyMembers",
            data: {
              count: String(node.types.length),
              max: String(maxMembers),
            },
          });
        }
      },
    };
  },
});
