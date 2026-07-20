import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { getInterfaceMembers } from "../utils/visitor-helpers.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("usecases/UC13-state-machines.md");

export default createRule({
  name: "no-parallel-boolean-state-flags",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow interfaces and type literals with 3+ boolean properties representing mutually exclusive states — use a discriminated union instead.",
    },
    messages: {
      tooManyBooleanFlags:
        "Found {{count}} boolean state flags ({{flags}}) in {{kind}}. Model mutually exclusive states with a discriminated union instead. See: {{url}}",
    },
    schema: [
      {
        type: "object",
        properties: {
          minCount: {
            type: "number",
            minimum: 2,
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
  },
  defaultOptions: [{ minCount: 3 }],
  create(context: TSESLint.RuleContext<"tooManyBooleanFlags", [{ minCount: number }]>) {
    const [{ minCount } = { minCount: 3 }] = context.options ?? [
      { minCount: 3 },
    ];

    const isBooleanFlag = (
      member: TSESTree.TypeElement,
    ): member is TSESTree.TSPropertySignature & {
      key: TSESTree.Identifier | TSESTree.Literal;
      typeAnnotation: { typeAnnotation: TSESTree.TypeNode };
    } =>
      member.type === "TSPropertySignature" &&
      (member.key.type === "Identifier" ||
        (member.key.type === "Literal" && typeof member.key.value === "string")) &&
      member.typeAnnotation?.typeAnnotation.type === "TSBooleanKeyword";

    function checkNode(
      node: TSESTree.TSInterfaceBody | TSESTree.TSTypeLiteral,
    ) {
      const members = getInterfaceMembers(node);
      const boolFlags = members.filter(isBooleanFlag);

      if (boolFlags.length >= minCount) {
        const flagNames = boolFlags
          .map((m) => {
            if (m.key.type === "Identifier") return m.key.name;
            if (m.key.type === "Literal" && typeof m.key.value === "string") return m.key.value;
            return String(m.key?.value ?? "?");
          })
          .join(", ");

        const parent = node.parent;
        let kind: string;
        if (parent?.type === "TSInterfaceDeclaration") {
          kind = `interface \`${parent.id?.name ?? "anonymous"}\``;
        } else if (parent?.type === "TSTypeAliasDeclaration") {
          kind = `type \`${parent.id?.name ?? "anonymous"}\``;
        } else {
          kind = "type";
        }

        context.report({
          node: parent ?? node,
          messageId: "tooManyBooleanFlags",
          data: {
            count: String(boolFlags.length),
            flags: flagNames,
            kind,
            url: URL,
          },
        });
      }
    }

    return {
      TSInterfaceBody(node: TSESTree.TSInterfaceBody) {
        checkNode(node);
      },
      TSTypeLiteral(node: TSESTree.TSTypeLiteral) {
        checkNode(node);
      },
    };
  },
});
