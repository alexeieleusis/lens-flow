import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T04-generics-bounds.md");

function getConditionalNestingDepth(node: TSESTree.TypeNode): number {
  if (node.type !== "TSConditionalType") return 0;

  const recurse = (type: TSESTree.TypeNode | undefined): number => {
    if (type?.type !== "TSConditionalType") return 0;
    let deepest = 1;
    const children = [
      type.checkType,
      type.extendsType,
      type.trueType,
      type.falseType,
    ];
    for (const child of children) {
      const d = recurse(child);
      if (d > 0) {
        const candidate = 1 + d;
        if (candidate > deepest) deepest = candidate;
      }
    }
    return deepest;
  };

  return (
    1 +
    Math.max(
      recurse(node.checkType),
      recurse(node.extendsType),
      recurse(node.trueType),
      recurse(node.falseType),
    )
  );
}

export default createRule({
  name: "no-excessively-nested-conditional-types",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow excessively nested conditional types that may exceed TypeScript's instantiation depth limit",
    },
    messages: {
      excessiveNesting:
        "Conditional type has nesting depth {{depth}} (max: {{max}}). Use a recursive helper with a depth counter instead. See: {{url}}",
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
  create(
    context: TSESLint.RuleContext<"excessiveNesting", [{ maxDepth: number }]>,
  ) {
    const options = context.options[0] ?? { maxDepth: 2 };

    return {
      TSConditionalType(node) {
        const depth = getConditionalNestingDepth(node);
        if (depth > options.maxDepth) {
          context.report({
            node,
            messageId: "excessiveNesting",
            data: {
              depth: String(depth),
              max: String(options.maxDepth),
              url: URL,
            },
          });
        }
      },
    };
  },
});
