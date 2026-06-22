import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

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
        "Abstract class '{{name}}' has only abstract members and no instance fields. Prefer an interface for structural typing. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC05-structural-contracts.md",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"preferInterface", []>) {
    return {
      ClassDeclaration(node) {
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

        if (properties.length > 0 || staticBlocks.length > 0) return;
        if (concreteMethods.length > 0) return;
        if (abstractMethods.length === 0) return;

        const name = node.id?.name ?? "unknown";
        context.report({
          node,
          messageId: "preferInterface",
          data: { name },
        });
      },
    };
  },
});
