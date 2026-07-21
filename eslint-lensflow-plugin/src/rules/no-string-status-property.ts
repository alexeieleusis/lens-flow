import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESLint } from "@typescript-eslint/utils";

const URL = knowledgeUrl("catalog/T52-literal-types.md");

export default createRule({
  name: "no-string-status-property",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow status-like properties typed as plain `string` — use a literal union instead.",
    },
    messages: {
      stringStatusField:
        'Property `{{name}}` is typed as plain `string`. Use a literal union (e.g. `"OK" | "ERROR"`) to constrain valid values. See: {{url}}',
    },
    schema: [
      {
        type: "object",
        properties: {
          statusFieldNames: {
            type: "array",
            items: { type: "string" },
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
  },
  defaultOptions: [
    {
      statusFieldNames: [
        "status",
        "state",
        "kind",
        "type",
        "mode",
        "phase",
        "step",
        "stage",
        "level",
      ],
    },
  ],
  create(
    context: TSESLint.RuleContext<
      "stringStatusField",
      [{ statusFieldNames: string[] }]
    >,
  ) {
    const defaults = [
      {
        statusFieldNames: [
          "status",
          "state",
          "kind",
          "type",
          "mode",
          "phase",
          "step",
          "stage",
          "level",
        ],
      },
    ];
    const [{ statusFieldNames } = defaults[0]] = context.options ?? defaults;

    const escapeReplacer = String.raw`\$&`;
    const pattern = new RegExp(
      `^(?:${statusFieldNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, escapeReplacer)).join("|")})$`,
      "i",
    );

    return {
      TSPropertySignature(node) {
        let keyName: string | null = null;
        if (node.key.type === "Identifier") {
          keyName = node.key.name;
        } else if (node.key.type === "Literal") {
          keyName = String(node.key.value);
        }

        if (!keyName || !pattern.test(keyName)) return;

        const typeAnn = node.typeAnnotation?.typeAnnotation;
        if (typeAnn?.type !== "TSStringKeyword") return;

        context.report({
          node,
          messageId: "stringStatusField",
          data: { name: keyName, url: URL },
        });
      },
    };
  },
});
