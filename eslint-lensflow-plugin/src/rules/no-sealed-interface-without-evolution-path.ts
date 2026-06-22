import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "no-sealed-interface-without-evolution-path",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow sealed interfaces (unique symbol property) without optional evolution members",
    },
    messages: {
      sealedNoEvolution:
        "Interface '{{name}}' uses a sealed symbol but has no optional members for backward-compatible evolution. Add optional members or use a class. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC10-encapsulation.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"sealedNoEvolution", []>) {
    return {
      TSInterfaceDeclaration(node) {
        const body = node.body;
        const members = body.body;

        // Check for sealed-symbol property: computed key with Identifier starting with underscore
        const hasSealedSymbol = members.some(
          (member) =>
            member.type === "TSPropertySignature" &&
            member.computed === true &&
            member.key.type === "Identifier" &&
            member.key.name.startsWith("_"),
        );

        if (!hasSealedSymbol) return;

        // Check for optional members (evolution path) — both property and method signatures
        const hasOptional = members.some(
          (member) =>
            (member.type === "TSPropertySignature" ||
              member.type === "TSMethodSignature") &&
            member.optional === true,
        );

        // Fewer than 5 total members
        const hasFewMembers = members.length < 5;

        if (!hasOptional && hasFewMembers) {
          context.report({
            node,
            messageId: "sealedNoEvolution",
            data: {
              name: node.id.name,
            },
          });
        }
      },
    };
  },
});
