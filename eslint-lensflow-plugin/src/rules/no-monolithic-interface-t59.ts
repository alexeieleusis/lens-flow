import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "no-monolithic-interface-t59",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow monolithic existential interfaces with too many members.",
    },
    messages: {
      tooManyMembers:
        "Interface '{{name}}' has {{count}} members (max {{max}}). Every implementor must provide all of them. Split into smaller focused interfaces or use intersection types. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T59-existential-types.md",
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
  defaultOptions: [{ maxMembers: 7 }],
  create(context: TSESLint.RuleContext<"tooManyMembers", [{ maxMembers: number }]>) {
    const [{ maxMembers } = { maxMembers: 7 }] = context.options ?? [];

    return {
      TSInterfaceBody(node) {
        const count = node.body.length;
        if (count >= maxMembers) {
          const decl = node.parent;
          const name =
            decl?.type === "TSInterfaceDeclaration" && decl.id
              ? decl.id.name
              : "anonymous";
          context.report({
            node: decl || node,
            messageId: "tooManyMembers",
            data: {
              name,
              count: String(count),
              max: String(maxMembers),
            },
          });
        }
      },
    };
  },
});
