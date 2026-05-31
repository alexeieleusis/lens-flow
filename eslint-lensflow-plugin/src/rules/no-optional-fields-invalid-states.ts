import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

export default createRule({
  name: "no-optional-fields-invalid-states",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow interfaces with multiple optional fields that may represent mutually exclusive states",
    },
    messages: {
      optionalFields:
        "Found {{optionalCount}} optional fields out of {{totalCount}} total. Consider using a discriminated union to represent mutually exclusive states. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/usecases/UC01-invalid-states.md",
    },
    schema: [
      {
        type: "object",
        properties: {
          minOptionalFields: {
            type: "number",
            minimum: 2,
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
  },
  defaultOptions: [{ minOptionalFields: 2 }],
  create(context: TSESLint.RuleContext<"optionalFields", [{ minOptionalFields: number }]>) {
    const [{ minOptionalFields } = { minOptionalFields: 2 }] =
      context.options ?? [{ minOptionalFields: 2 }];

    function checkBody(
      elements: unknown[],
      reportNode: TSESTree.Node,
    ) {
      const optionalFields = elements.filter(
        (m) =>
          typeof m === "object" &&
          m !== null &&
          (m as { type: string }).type === "TSPropertySignature" &&
          (m as { optional?: boolean }).optional === true,
      );
      const totalFields = elements.filter(
        (m) =>
          typeof m === "object" &&
          m !== null &&
          (m as { type: string }).type === "TSPropertySignature",
      );

      if (
        optionalFields.length >= minOptionalFields &&
        totalFields.length >= 3
      ) {
        context.report({
          node: reportNode,
          messageId: "optionalFields",
          data: {
            optionalCount: String(optionalFields.length),
            totalCount: String(totalFields.length),
          },
        });
      }
    }

    return {
      TSInterfaceBody(node) {
        checkBody(node.body, node.parent);
      },

      TSTypeLiteral(node) {
        checkBody(node.members, node);
      },
    };
  },
});
