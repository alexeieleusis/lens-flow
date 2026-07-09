import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

export default createRule({
  name: "no-many-function-parameters",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow functions with many separate parameters that should be grouped into a config object",
    },
    messages: {
      tooManyParams:
        "Function has {{count}} parameters (max {{maxParams}}). Consider grouping related parameters into a configuration object. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T05-type-classes.md",
    },
    schema: [
      {
        type: "object",
        properties: {
          maxParams: {
            type: "number",
            minimum: 1,
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
  },
  defaultOptions: [{ maxParams: 5 }],
  create(context: TSESLint.RuleContext<"tooManyParams", [{ maxParams: number }]>) {
    const [{ maxParams } = { maxParams: 5 }] = context.options ?? [];

    function checkParams(node: TSESTree.FunctionLike) {
      const params = node.params;
      const hasTSParameterProperty = params.some(
        (p) => p.type === "TSParameterProperty",
      );
      if (hasTSParameterProperty) return;

      const lastParam = params[params.length - 1];
      let count = params.length - (lastParam?.type === "RestElement" ? 1 : 0);

      if (count >= maxParams) {
        context.report({
          node,
          messageId: "tooManyParams",
          data: {
            count: String(count),
            maxParams: String(maxParams),
          },
        });
      }
    }

    return {
      FunctionDeclaration: checkParams,
      FunctionExpression: checkParams,
      ArrowFunctionExpression: checkParams,
    };
  },
});
