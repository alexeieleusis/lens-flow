import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

const URL = knowledgeUrl("usecases/UC05-structural-contracts.md");

export default createRule({
  name: "prefer-interface-over-pure-abstract-class",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer an interface over an abstract class that has only abstract members and no instance fields",
    },
    messages: {
      preferInterface:
        "Abstract class '{{name}}' has only abstract members and no instance fields. Prefer an interface for structural typing. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"preferInterface", []>) {
    function visitAbstractClass(
      node: TSESTree.ClassDeclaration | TSESTree.ClassExpression,
    ) {
      if (!node.abstract) return;

      const members = node.body.body;

      const abstractMethods = members.filter(
        (m) => m.type === "TSAbstractMethodDefinition",
      );
      const concreteMethods = members.filter(
        (m) => m.type === "MethodDefinition" && m.value.body !== null,
      );
      const properties = members.filter(
        (m) => m.type === "PropertyDefinition",
      );
      const staticBlocks = members.filter(
        (m) => m.type === "StaticBlock",
      );

      const hasConstructorParamProperties = members.some(
        (m) =>
          m.type === "MethodDefinition" &&
          m.kind === "constructor" &&
          m.value.body !== null &&
          m.value.params.some((p) => p.type === "TSParameterProperty"),
      );

      if (properties.length > 0 || staticBlocks.length > 0) return;
      if (hasConstructorParamProperties) return;
      if (concreteMethods.length > 0) return;
      if (abstractMethods.length === 0) return;
      if (abstractMethods.some((m) => m.static)) return;

      const name = node.id?.name ?? "unknown";
      context.report({
        node,
        messageId: "preferInterface",
        data: { name, url: URL },
      });
    }

    return {
      ClassDeclaration: visitAbstractClass,
      ClassExpression: visitAbstractClass,
    };
  },
});
