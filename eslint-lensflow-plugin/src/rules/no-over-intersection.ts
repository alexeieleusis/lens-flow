import { TSESTree, TSESLint } from '@typescript-eslint/utils';
import { createRule } from "../utils/rule-creator.js";

function countFlattenedMembers(
  node: TSESTree.TypeNode,
): number {
  if (node.type === "TSIntersectionType") {
    return node.types.reduce(
      (sum: number, member: TSESTree.TypeNode) => sum + countFlattenedMembers(member),
      0,
    );
  }
  return 1;
}

export default createRule({
  name: "no-over-intersection",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow intersection types with too many members or deeply nested intersections.",
    },
    messages: {
      tooManyDirect:
        "Intersection type has {{count}} direct members (max: {{max}}). Consider breaking it into smaller composed types. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/usecases/UC05-structural-contracts.md",
      tooManyFlattened:
        "Intersection type flattens to {{count}} members (max: {{max}}). Deep nesting makes types unreadable. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/usecases/UC05-structural-contracts.md",
    },
    schema: [
      {
        type: "object",
        properties: {
          maxMembers: {
            type: "number",
            minimum: 2,
          },
          maxFlattenedMembers: {
            type: "number",
            minimum: 3,
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
  },
  defaultOptions: [{ maxMembers: 4, maxFlattenedMembers: 6 }],
  create(context: TSESLint.RuleContext<"tooManyDirect" | "tooManyFlattened", [{ maxMembers: number, maxFlattenedMembers: number }]>) {
    const [{ maxMembers, maxFlattenedMembers } = {}] =
      context.options ?? [];
    const thresholdDirect = maxMembers ?? 4;
    const thresholdFlattened = maxFlattenedMembers ?? 6;

    return {
      TSIntersectionType(node) {
        const directCount = node.types.length;

        if (directCount >= thresholdDirect) {
          context.report({
            node,
            messageId: "tooManyDirect",
            data: {
              count: String(directCount),
              max: String(thresholdDirect),
            },
          });
        }

        const flattenedCount = countFlattenedMembers(node);

        if (flattenedCount >= thresholdFlattened) {
          context.report({
            node,
            messageId: "tooManyFlattened",
            data: {
              count: String(flattenedCount),
              max: String(thresholdFlattened),
            },
          });
        }
      },
    };
  },
});
