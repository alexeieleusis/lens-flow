import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "no-deeply-nested-conditional-types",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow conditional types nested more than 4 levels deep without intermediate named type aliases. Configurable via `maxDepth`",
    },
    messages: {
      deepNesting:
        "Conditional type nested {{depth}} levels deep. Extract intermediate levels into named type aliases for readability. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T17-macros-metaprogramming.md",
    },
    schema: [
      {
        type: "object",
        properties: {
          maxDepth: {
            type: "number",
            minimum: 2,
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
  },
  defaultOptions: [{ maxDepth: 4 }],
  create(context: TSESLint.RuleContext<"deepNesting", [{ maxDepth: number }]>) {
    const [{ maxDepth = 4 } = {}] = context.options ?? [];

    return {
      TSConditionalType(node) {
        const ancestors = context.sourceCode.getAncestors(node);
        const depth =
          1 +
          ancestors.filter(
            (ancestor) => ancestor.type === "TSConditionalType",
          ).length;

        if (depth > maxDepth) {
          context.report({
            node,
            messageId: "deepNesting",
            data: {
              depth: String(depth),
            },
          });
        }
      },
    };
  },
});
