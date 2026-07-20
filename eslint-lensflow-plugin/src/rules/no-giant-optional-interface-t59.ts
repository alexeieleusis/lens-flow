import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

const URL = knowledgeUrl("catalog/T59-existential-types.md");

function countOptionalProps(members: TSESTree.Node[]) {
  return members.filter(
    (member) =>
      (member as any).type === "TSPropertySignature" && (member as any).optional,
  );
}

export default createRule({
  name: "no-giant-optional-interface-t59",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow interfaces and inline type literals with many optional fields that enumerate all possible states instead of using polymorphic components.",
    },
    messages: {
      tooManyOptional:
        "'{{name}}' has {{count}} optional properties. Consider using polymorphic components to handle distinct configurations instead. See: {{url}}",
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
    const { maxOptional = 10 } = context.options[0] ?? {};

    return {
      TSInterfaceBody(node) {
        const optionalProps = countOptionalProps(node.body);
        if (optionalProps.length >= maxOptional) {
          const decl = node.parent;
          const name =
            decl?.type === "TSInterfaceDeclaration" && decl?.id
              ? (decl as any).id.name
              : "anonymous";
          context.report({
            node: decl || node,
            messageId: "tooManyOptional",
            data: { name, count: String(optionalProps.length), url: URL },
          });
        }
      },
      TSTypeLiteral(node) {
        const optionalProps = countOptionalProps(node.members);
        if (optionalProps.length >= maxOptional) {
          const decl = node.parent;
          const name =
            decl?.type === "TSTypeAliasDeclaration" && decl?.id
              ? (decl as any).id.name
              : "anonymous";
          context.report({
            node: decl || node,
            messageId: "tooManyOptional",
            data: { name, count: String(optionalProps.length), url: URL },
          });
        }
      },
    };
  },
});
