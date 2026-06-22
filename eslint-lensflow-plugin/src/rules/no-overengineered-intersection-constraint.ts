import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "no-overengineered-intersection-constraint",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow generic constraints that intersect multiple named interfaces when an inline structural constraint would be simpler",
    },
    messages: {
      overengineeredIntersection:
        "Generic constraint intersects {{count}} named type(s) ({{types}}). Consider using an inline structural constraint instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/usecases/UC04-generic-constraints.md",
    },
    schema: [
      {
        type: "object",
        properties: {
          minIntersectionMembers: {
            type: "number",
            minimum: 2,
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
  },
  defaultOptions: [{ minIntersectionMembers: 2 }],
  create(context: TSESLint.RuleContext<"overengineeredIntersection", [{ minIntersectionMembers: number }]>) {
    const [{ minIntersectionMembers } = { minIntersectionMembers: 2 }] =
      context.options ?? [{ minIntersectionMembers: 2 }];

    return {
      TSTypeParameter(node) {
        if (!node.constraint) return;
        const constraint =
          node.constraint.type === "TSParenthesizedType"
            ? node.constraint.typeAnnotation
            : node.constraint;
        if (constraint.type !== "TSIntersectionType") return;

        const typeRefs = constraint.types.filter(
          (member) => member.type === "TSTypeReference",
        );

        if (typeRefs.length >= minIntersectionMembers) {
          const names = typeRefs
            .map((m) => {
              return m.typeName.type === "Identifier" ? m.typeName.name : "?";
            })
            .join(", ");

          context.report({
            node,
            messageId: "overengineeredIntersection",
            data: {
              count: String(typeRefs.length),
              types: names,
            },
          });
        }
      },
    };
  },
});
