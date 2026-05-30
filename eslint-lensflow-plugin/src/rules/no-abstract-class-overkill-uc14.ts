import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

type Options = [{ maxAbstractMethods?: number }];
type MessageIds = "abstractOverkill";

export default createRule<Options, MessageIds>({
  name: "no-abstract-class-overkill-uc14",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow abstract classes with only a few abstract methods and no shared behavior, preferring interfaces instead.",
    },
    messages: {
      abstractOverkill:
        "Abstract class '{{name}}' has {{count}} abstract method(s), no instance fields, and no shared behavior. Use an interface instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/usecases/UC14-extensibility.md",
    },
    schema: [
      {
        type: "object",
        properties: {
          maxAbstractMethods: {
            type: "number",
            minimum: 1,
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
  },
  defaultOptions: [{ maxAbstractMethods: 2 }],
  create(context: TSESLint.RuleContext<MessageIds, Options>) {
    const [{ maxAbstractMethods = 2 } = {}] = context.options ?? [];

    return {
      ClassDeclaration(node) {
        if (!node.abstract) return;

        const body = node.body;
        const members = body.body;

        const abstractMethods = members.filter(
          (m) => m.type === "TSAbstractMethodDefinition",
        );
        const instanceFields = members.filter(
          (m) => m.type === "PropertyDefinition",
        );
        const concreteMethods = members.filter(
          (m) =>
            m.type === "MethodDefinition" && m.value.body !== null,
        );

        const abstractCount = abstractMethods.length;

        if (
          abstractCount >= 1 &&
          abstractCount <= maxAbstractMethods &&
          instanceFields.length === 0 &&
          concreteMethods.length === 0
        ) {
          const className =
            node.id?.type === "Identifier" ? node.id.name : "unknown";
          context.report({
            node,
            messageId: "abstractOverkill",
            data: {
              name: className,
              count: String(abstractCount),
            },
          });
        }
      },
    };
  },
});
