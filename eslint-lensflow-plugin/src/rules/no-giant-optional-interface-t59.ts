import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "no-giant-optional-interface-t59",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow interfaces with many optional fields that enumerate all possible states instead of using polymorphic components.",
    },
    messages: {
      tooManyOptional:
        "Interface '{{name}}' has {{count}} optional properties. Consider using polymorphic components to handle distinct configurations instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T59-existential-types.md",
    },
    schema: [
      {
        type: "object",
        properties: {
          maxOptional: {
            type: "number",
            minimum: 1,
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
  },
  defaultOptions: [{ maxOptional: 10 }],
  create(context: TSESLint.RuleContext<"tooManyOptional", [{ maxOptional: number }]>) {
    const [{ maxOptional } = { maxOptional: 10 }] = context.options ?? [];

    return {
      TSInterfaceBody(node) {
        const optionalProps = node.body.filter(
          (member) =>
            member.type === "TSPropertySignature" && member.optional,
        );
        if (optionalProps.length >= maxOptional) {
          const decl = node.parent;
          const name =
            decl?.type === "TSInterfaceDeclaration" && decl?.id
              ? decl.id.name
              : "anonymous";
          context.report({
            node: decl || node,
            messageId: "tooManyOptional",
            data: {
              name,
              count: String(optionalProps.length),
            },
          });
        }
      },
    };
  },
});
