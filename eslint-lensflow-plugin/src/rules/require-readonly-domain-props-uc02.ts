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
  name: "require-readonly-domain-props-uc02",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Require `readonly` on all properties in domain object interfaces and type literals to prevent silent state corruption.",
    },
    messages: {
      mutableDomainProp:
        "Property `{{name}}` is mutable. Domain object properties should be `readonly` to enforce immutable transformation. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC02-domain-modeling.md",
    },
    schema: [
      {
        type: "object",
        properties: {
          minProperties: {
            type: "number",
            minimum: 1,
            default: 2,
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
  },
  defaultOptions: [{ minProperties: 2 }],
  create(context: TSESLint.RuleContext<"mutableDomainProp", [{ minProperties: number }]>) {
    const [{ minProperties } = { minProperties: 2 }] = context.options ?? [
      { minProperties: 2 },
    ];

    function checkParent(
      node: TSESTree.TSInterfaceBody | TSESTree.TSTypeLiteral,
    ) {
      const members = getMembers(node);
      if (members.length < minProperties) return;

      for (const member of members) {
        if (
          member.type === "TSPropertySignature" &&
          member.readonly !== true
        ) {
          let propName: string;
          if (member.key.type === "Identifier") {
            propName = member.key.name;
          } else if (member.key.type === "Literal") {
            propName = String(member.key.value);
          } else {
            propName = "?";
          }

          context.report({
            node: member,
            messageId: "mutableDomainProp",
            data: { name: propName },
          });
        }
      }
    }

    return {
      TSInterfaceBody(node) {
        checkParent(node);
      },
      TSTypeLiteral(node) {
        checkParent(node);
      },
    };
  },
});
