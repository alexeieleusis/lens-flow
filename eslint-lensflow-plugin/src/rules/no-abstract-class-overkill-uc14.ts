import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

const URL = knowledgeUrl("usecases/UC14-extensibility.md");

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
        "Abstract class '{{name}}' has {{count}} abstract method(s), no instance fields, and no shared behavior. Use an interface instead. See: {{url}}",
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

    const checkAbstractClass = (
      node: TSESTree.ClassDeclaration | TSESTree.ClassExpression,
    ): void => {
      if (!node.abstract) return;

      const members = node.body.body;

      const abstractMethods = members.filter(
        (m): m is TSESTree.TSAbstractMethodDefinition =>
          m.type === "TSAbstractMethodDefinition",
      );
      const instanceFields = members.filter(
        (m): m is TSESTree.PropertyDefinition =>
          m.type === "PropertyDefinition" && !m.static,
      );
      // Also count constructor parameter properties as instance state
      const constructorParamProps = members
        .filter(
          (m): m is TSESTree.MethodDefinition =>
            m.type === "MethodDefinition" &&
            m.kind === "constructor" &&
            m.value.params !== undefined,
        )
        .flatMap((m) => m.value.params)
        .filter(
          (p): p is TSESTree.TSParameterProperty =>
            p.type === "TSParameterProperty",
        );
      const concreteMethods = members.filter(
        (m): m is TSESTree.MethodDefinition =>
          m.type === "MethodDefinition" && m.value.body !== null,
      );

      const abstractCount = abstractMethods.length;

      if (
        abstractCount >= 1 &&
        abstractCount <= maxAbstractMethods &&
        instanceFields.length === 0 &&
        constructorParamProps.length === 0 &&
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
            url: URL,
          },
        });
      }
    };

    return {
      ClassDeclaration(node) {
        checkAbstractClass(node);
      },
      ClassExpression(node) {
        checkAbstractClass(node);
      },
    };
  },
});
