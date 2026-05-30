import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "no-fat-interface",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow interfaces with too many members that couple unrelated concerns",
    },
    messages: {
      tooManyMembers:
        "Interface '{{name}}' has {{count}} members (max {{max}}). Consider splitting into smaller, focused interfaces. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T36-trait-objects.md",
    },
    schema: [
      {
        type: "object",
        properties: {
          maxMembers: {
            type: "number",
            minimum: 1,
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
  },
  defaultOptions: [{ maxMembers: 5 }],
  create(context: TSESLint.RuleContext<"tooManyMembers", [{ maxMembers: number }]>) {
    const [{ maxMembers } = { maxMembers: 5 }] = context.options ?? [];

    return {
      TSInterfaceBody(node) {
        const memberTypes = new Set([
          "TSPropertySignature",
          "TSMethodSignature",
          "TSCallSignatureDeclaration",
          "TSConstructSignatureDeclaration",
        ]);
        const members = node.body.filter(
          (member) => memberTypes.has(member.type),
        );
        if (members.length >= maxMembers) {
          const declaration = node.parent;
          const name =
            declaration?.type === "TSInterfaceDeclaration"
              ? declaration.id.name
              : "Anonymous";
          context.report({
            node: declaration || node,
            messageId: "tooManyMembers",
            data: {
              name,
              count: String(members.length),
              max: String(maxMembers),
            },
          });
        }
      },
    };
  },
});
