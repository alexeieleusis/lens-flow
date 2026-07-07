import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "no-over-generic-interface",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow interfaces with 3 or more type parameters, which are likely over-parameterized.",
    },
    messages: {
      tooManyTypeParams:
        "Interface '{{name}}' has {{count}} type parameters (max {{max}}). Consider simplifying the contract or using concrete types. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC14-extensibility.md",
    },
    schema: [
      {
        type: "object",
        properties: {
          maxTypeParams: {
            type: "number",
            minimum: 1,
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
  },
  defaultOptions: [{ maxTypeParams: 3 }],
  create(context: TSESLint.RuleContext<"tooManyTypeParams", [{ maxTypeParams: number }]>) {
    const { maxTypeParams = 3 } = context.options[0] ?? {};

    return {
      TSInterfaceDeclaration(node) {
        const typeParams = node.typeParameters?.params ?? [];
        if (typeParams.length > maxTypeParams) {
          const name = node.id ? node.id.name : "(anonymous)";
          context.report({
            node,
            messageId: "tooManyTypeParams",
            data: {
              name,
              count: String(typeParams.length),
              max: String(maxTypeParams),
            },
          });
        }
      },
    };
  },
});
