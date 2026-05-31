import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { createBooleanFlagChecker } from "../utils/visitor-helpers.js";

export default createRule({
  name: "no-parallel-boolean-flags",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow interfaces and type literals with 3+ isXxx boolean flags — use a discriminated union instead.",
    },
    messages: {
      tooManyFlags:
        "Found {{count}} boolean flag(s) ({{flags}}) in {{kind}}. Model mutually exclusive states with a discriminated union instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T01-algebraic-data-types.md",
    },
    schema: [
      {
        type: "object",
        properties: {
          maxFlags: {
            type: "number",
            minimum: 2,
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
  },
  defaultOptions: [{ maxFlags: 3 }],
  create(context: TSESLint.RuleContext<"tooManyFlags", [{ maxFlags: number }]>) {
    const [{ maxFlags } = { maxFlags: 3 }] = context.options ?? [
      { maxFlags: 3 },
    ];

    const isIsXxxBooleanFlag = (
      member: TSESTree.TypeElement,
    ): member is TSESTree.TSPropertySignature & {
      key: TSESTree.Identifier;
      typeAnnotation: { typeAnnotation: TSESTree.TypeNode };
    } =>
      member.type === "TSPropertySignature" &&
      member.key.type === "Identifier" &&
      /^is[A-Z]/.test(member.key.name) &&
      member.typeAnnotation?.typeAnnotation.type === "TSBooleanKeyword";

    return createBooleanFlagChecker(maxFlags, isIsXxxBooleanFlag, "tooManyFlags")(context);
  },
});
