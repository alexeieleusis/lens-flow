import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESLint } from "@typescript-eslint/utils";
import type { TSESTree } from "@typescript-eslint/types";

const URL = knowledgeUrl("usecases/UC07-callable-contracts.md");

type FnLikeNode = TSESTree.FunctionDeclaration | TSESTree.TSDeclareFunction;

export default createRule({
  name: "no-overload-explosion",
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow functions with more than 5 overload signatures",
    },
    messages: {
      tooManyOverloads:
        "Function '{{name}}' has {{count}} overload signatures, which makes the API hard to maintain. Consider using a discriminated union input instead. See: {{url}}",
    },
    schema: [
      {
        type: "object",
        properties: {
          maxOverloads: {
            type: "number",
            minimum: 1,
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
  },
  defaultOptions: [{ maxOverloads: 5 }],
  create(
    context: TSESLint.RuleContext<
      "tooManyOverloads",
      [{ maxOverloads: number }]
    >,
  ) {
    const { maxOverloads = 5 } = context.options[0] ?? {};
    const fnGroups = new Map<
      string,
      { nodes: FnLikeNode[]; overloads: number }
    >();

    return {
      FunctionDeclaration(node) {
        const name = node.id?.name;
        if (!name) return;
        if (!fnGroups.has(name)) {
          fnGroups.set(name, { nodes: [], overloads: 0 });
        }
        const group = fnGroups.get(name)!;
        group.nodes.push(node);
        if (node.body === null) {
          group.overloads++;
        }
      },
      TSDeclareFunction(node) {
        const name = node.id?.name;
        if (!name) return;
        if (!fnGroups.has(name)) {
          fnGroups.set(name, { nodes: [], overloads: 0 });
        }
        const group = fnGroups.get(name)!;
        group.nodes.push(node);
        group.overloads++;
      },
      "Program:exit"() {
        for (const [name, group] of fnGroups) {
          if (group.overloads > maxOverloads) {
            context.report({
              node: group.nodes[0],
              messageId: "tooManyOverloads",
              data: {
                name,
                count: String(group.overloads),
                url: URL,
              },
            });
          }
        }
      },
    };
  },
});
