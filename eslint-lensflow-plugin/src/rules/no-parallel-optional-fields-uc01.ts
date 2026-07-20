import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { getMembers, countOptionalFields } from "../utils/optional-fields-helper.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("usecases/UC01-invalid-states.md");

export default createRule({
  name: "no-parallel-optional-fields-uc01",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow using multiple optional fields on an interface or type literal to represent partial initialization, creating invalid states the type system cannot prevent.",
    },
    messages: {
      tooManyOptionalFields:
        "Found {{count}} optional field(s) ({{fields}}). Using optional fields to represent partial initialization creates invalid states the type system cannot prevent. Consider using a discriminated union instead. See: {{url}}",
    },
    schema: [
      {
        type: "object",
        properties: {
          minOptionalFields: {
            type: "number",
            minimum: 1,
          },
          minTotalFields: {
            type: "number",
            minimum: 1,
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
  },
  defaultOptions: [{ minOptionalFields: 3 }],
  create(
    context: TSESLint.RuleContext<
      "tooManyOptionalFields",
      [{ minOptionalFields: number; minTotalFields?: number }]
    >,
  ) {
    const [
      { minOptionalFields, minTotalFields } = { minOptionalFields: 3 },
    ] = context.options ?? [{ minOptionalFields: 3 }];

    function checkNode(
      node: TSESTree.TSInterfaceBody | TSESTree.TSTypeLiteral,
    ) {
      const { optionalCount, totalFields, optionalFields } =
        countOptionalFields(getMembers(node));

      if (
        optionalCount >= minOptionalFields &&
        (!minTotalFields || totalFields >= minTotalFields)
      ) {
        const fields = optionalFields
          .map((m) => (m.key.type === "Identifier" ? m.key.name : "?"))
          .join(", ");

        context.report({
          node: node.parent ?? node,
          messageId: "tooManyOptionalFields",
          data: {
            count: String(optionalCount),
            fields,
            total: String(totalFields),
            url: URL,
          },
        });
      }
    }

    return {
      TSInterfaceBody(node) {
        checkNode(node);
      },
      TSTypeLiteral(node) {
        checkNode(node);
      },
    };
  },
});
