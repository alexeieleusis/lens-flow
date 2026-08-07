import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import {
  createBooleanFlagChecker,
  BooleanFlagMember,
} from "../utils/visitor-helpers.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl(
  "usecases/UC13-state-machines.md",
  "Antipattern 2: Union of boolean flags",
);

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
  create(
    context: TSESLint.RuleContext<
      "tooManyBooleanFlags",
      [{ minCount: number }]
    >,
  ) {
    const [{ minCount } = { minCount: 3 }] = context.options ?? [
      { minCount: 3 },
    ];

    const isBooleanFlag = (
      member: TSESTree.TypeElement,
    ): member is BooleanFlagMember =>
      member.type === "TSPropertySignature" &&
      (member.key.type === "Identifier" ||
        (member.key.type === "Literal" &&
          typeof member.key.value === "string")) &&
      member.typeAnnotation?.typeAnnotation.type === "TSBooleanKeyword";

    return createBooleanFlagChecker(
      minCount,
      isBooleanFlag,
      "tooManyBooleanFlags",
      URL,
    )(context);
  },
});
