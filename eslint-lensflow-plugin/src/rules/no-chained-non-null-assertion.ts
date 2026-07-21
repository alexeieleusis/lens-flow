import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("usecases/UC16-nullability.md");

function getChain(node: TSESTree.TSNonNullExpression): {
  count: number;
  nodes: TSESTree.TSNonNullExpression[];
} {
  const nodes: TSESTree.TSNonNullExpression[] = [node];
  let current: TSESTree.Node = node.expression;

  let hasMemberAccess = false;

  while (current.type === "MemberExpression") {
    hasMemberAccess = true;
    if (current.object.type === "TSNonNullExpression") {
      nodes.push(current.object);
      current = current.object.expression;
    } else {
      current = current.object;
    }
  }

  if (hasMemberAccess && current.type === "TSNonNullExpression") {
    nodes.push(current);
  }

  return { count: nodes.length, nodes };
}

export default createRule({
  name: "no-chained-non-null-assertion",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow chaining two or more non-null assertion operators in a member-access chain",
    },
    messages: {
      chainedNonNull:
        "Found {{count}} chained non-null assertion operators (!). Use optional chaining (?.) with an explicit null check instead. See: {{url}}",
    },
    schema: [
      {
        type: "object",
        properties: {
          minChain: {
            type: "number",
            minimum: 2,
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
  },
  defaultOptions: [{ minChain: 2 }],
  create(
    context: TSESLint.RuleContext<"chainedNonNull", [{ minChain: number }]>,
  ) {
    const [{ minChain } = { minChain: 2 }] = context.options ?? [
      { minChain: 2 },
    ];
    const reported = new Set<TSESTree.TSNonNullExpression>();

    return {
      TSNonNullExpression(node) {
        if (reported.has(node)) return;

        const { count, nodes } = getChain(node);

        if (count >= minChain) {
          nodes.forEach((n) => reported.add(n));

          context.report({
            node,
            messageId: "chainedNonNull",
            data: {
              count: String(count),
              url: URL,
            },
          });
        }
      },
    };
  },
});
