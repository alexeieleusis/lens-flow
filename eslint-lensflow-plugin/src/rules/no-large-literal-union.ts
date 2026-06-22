import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "no-large-literal-union",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow literal union types with too many members, which cause combinatorial blowup and slow type checks.",
    },
    messages: {
      tooManyLiteralMembers:
        "This union type has {{count}} literal members (max: {{max}}). Large literal unions cause combinatorial blowup in template types and slow type checks. Consider extracting to a const object and using `typeof Obj[keyof typeof Obj]` instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T52-literal-types.md",
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
  defaultOptions: [{ maxMembers: 20 }],
  create(context: TSESLint.RuleContext<"tooManyLiteralMembers", [{ maxMembers?: number }]>) {
    const { maxMembers = 20 } = context.options[0] ?? {};

    return {
      TSUnionType(node) {
        const literalMembers = node.types.filter(
          (member) => member.type === "TSLiteralType",
        );

        if (literalMembers.length > maxMembers) {
          const parent = node.parent;
          const reportNode =
            parent?.type === "TSTypeAliasDeclaration" &&
            parent.typeAnnotation === node
              ? parent
              : node;

          context.report({
            node: reportNode,
            messageId: "tooManyLiteralMembers",
            data: {
              count: String(literalMembers.length),
              max: String(maxMembers),
            },
          });
        }
      },
    };
  },
});
