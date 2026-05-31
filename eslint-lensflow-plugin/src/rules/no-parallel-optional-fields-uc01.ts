import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

function getMembers(
  node: TSESTree.TSInterfaceBody | TSESTree.TSTypeLiteral,
): TSESTree.TypeElement[] {
  if (node.type === "TSInterfaceBody") {
    return node.body;
  }
  return node.members;
}

export default createRule({
  name: "no-parallel-optional-fields-uc01",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow using 3+ optional fields on an interface or type literal to represent partial initialization, creating invalid states the type system cannot prevent.",
    },
    messages: {
      tooManyOptionalFields:
        "Found {{count}} optional field(s) ({{fields}}). Using optional fields to represent partial initialization creates invalid states the type system cannot prevent. Consider using a discriminated union instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/usecases/UC01-invalid-states.md",
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
  defaultOptions: [{ minOptionalFields: 3 }],
  create(context: TSESLint.RuleContext<"tooManyOptionalFields", [{ minOptionalFields: number }]>) {
    const [{ minOptionalFields } = { minOptionalFields: 3 }] =
      context.options ?? [{ minOptionalFields: 3 }];

    function checkNode(
      node: TSESTree.TSInterfaceBody | TSESTree.TSTypeLiteral,
    ) {
      const members = getMembers(node);
      const optionalFields = members.filter(
        (member): member is TSESTree.TSPropertySignature =>
          member.type === "TSPropertySignature" && member.optional,
      );

      if (optionalFields.length >= minOptionalFields) {
        const fields = optionalFields
          .map((m) => (m.key.type === "Identifier" ? m.key.name : "?"))
          .join(", ");

        const parent = node.parent;

        context.report({
          node: parent ?? node,
          messageId: "tooManyOptionalFields",
          data: {
            count: String(optionalFields.length),
            fields,
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
