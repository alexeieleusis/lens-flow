import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESLint } from "@typescript-eslint/utils";

const URL = knowledgeUrl("usecases/UC04-generic-constraints.md");

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
        "Generic constraint intersects {{count}} named type(s) ({{types}}). Consider using an inline structural constraint instead. See: {{url}}",
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
        if (node.constraint.type !== "TSIntersectionType") return;

        const typeRefs = node.constraint.types.filter(
          (member) => member.type === "TSTypeReference",
        );

        if (typeRefs.length >= minIntersectionMembers) {
          const names = typeRefs
            .map((m) => {
              if (m.typeName.type === "Identifier") return m.typeName.name;
              if (m.typeName.type === "TSQualifiedName") return m.typeName.right.name;
              return "?";
            })
            .join(", ");

          context.report({
            node,
            messageId: "overengineeredIntersection",
            data: {
              count: String(typeRefs.length),
              types: names,
              url: URL,
            },
          });
        }
      },
    };
  },
});
