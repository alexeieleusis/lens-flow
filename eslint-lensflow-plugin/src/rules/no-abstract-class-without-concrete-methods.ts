import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESLint } from "@typescript-eslint/utils";

const URL = knowledgeUrl("catalog/T05-type-classes.md");

export default createRule({
  name: "no-abstract-class-without-concrete-methods",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow abstract classes that have no concrete method implementations",
    },
    messages: {
      noConcreteMethods:
        "Abstract class '{{name}}' has no concrete methods — use an interface instead. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"noConcreteMethods", []>) {
    return {
      ClassDeclaration(node) {
        if (!node.abstract) return;

        const hasPropsOrConstructor = node.body.body.some(
          (member) =>
            member.type === "PropertyDefinition" ||
            (member.type === "MethodDefinition" &&
              member.kind === "constructor" &&
              (member.value as any).body !== null &&
              (member.value as any).body.body.length > 0),
        );

        if (hasPropsOrConstructor) return;

        const methods = node.body.body.filter(
          (member) =>
            member.type === "MethodDefinition" ||
            member.type === "TSAbstractMethodDefinition",
        );

        const abstractCount = methods.filter(
          (m) => m.type === "TSAbstractMethodDefinition" || (m as any).abstract,
        ).length;
        const concreteCount = methods.length - abstractCount;

        if (concreteCount === 0 && abstractCount > 0) {
          context.report({
            node,
            messageId: "noConcreteMethods",
            data: {
              name: node.id?.name ?? "<anonymous>",
              url: URL,
            },
          });
        }
      },
    };
  },
});
