import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T02-union-intersection.md");

function computeMaxDepth(node: TSESTree.TSTypeLiteral): number {
  let depth = 1;

  for (const member of node.members) {
    if (member.type !== "TSPropertySignature") continue;
    const typeAnnotation = member.typeAnnotation?.typeAnnotation;
    if (!typeAnnotation) continue;

    let memberDepth = 0;
    if (typeAnnotation.type === "TSTypeLiteral") {
      memberDepth = computeMaxDepth(typeAnnotation);
    } else if (
      typeAnnotation.type === "TSUnionType" ||
      typeAnnotation.type === "TSIntersectionType"
    ) {
      memberDepth = Math.max(
        0,
        ...typeAnnotation.types.filter(
          (t): t is TSESTree.TSTypeLiteral => t.type === "TSTypeLiteral",
        ).map(computeMaxDepth),
      );
    }

    if (memberDepth >= depth) {
      depth = 1 + memberDepth;
    }
  }

  return depth;
}

export default createRule({
  name: "no-deeply-nested-union-members",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow union members with deeply nested object types that require deep branching guards to narrow.",
    },
    messages: {
      deepNesting:
        "Union member has a nesting depth of {{depth}} (max {{maxDepth}}). Flatten the structure to simplify narrowing. See: {{url}}",
    },
    schema: [
      {
        type: "object",
        properties: {
          maxDepth: {
            type: "number",
            minimum: 1,
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
  },
  defaultOptions: [{ maxDepth: 2 }],
  create(context: TSESLint.RuleContext<"deepNesting", [{ maxDepth: number }]>) {
    const [{ maxDepth } = { maxDepth: 2 }] = context.options ?? [
      { maxDepth: 2 },
    ];

    return {
      TSUnionType(node) {
        for (const member of node.types) {
          if (member.type !== "TSTypeLiteral") continue;

          const depth = computeMaxDepth(member);
          if (depth > maxDepth) {
            context.report({
              node: member,
              messageId: "deepNesting",
              data: {
                depth: String(depth),
                maxDepth: String(maxDepth),
                url: URL,
              },
            });
          }
        }
      },
    };
  },
});
