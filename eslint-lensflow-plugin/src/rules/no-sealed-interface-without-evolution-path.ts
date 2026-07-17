import { createRule } from "../utils/rule-creator.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

function isSealedSymbolMember(member: TSESTree.TSInterfaceBody["body"][number]): boolean {
  // Index signature: [key: unique symbol]: never
  if (member.type === "TSIndexSignature" && member.parameters.length > 0) {
    const param = member.parameters[0];
    if (param.type === "Identifier") {
      const paramType = param.typeAnnotation?.typeAnnotation;
      if (paramType) {
        if (
          paramType.type === "TSTypeOperator" &&
          paramType.operator === "unique"
        ) {
          return true;
        }
        if (paramType.type === "TSTypeQuery") {
          return true;
        }
      }
    }
  }

  // Computed property with underscore-prefixed key and never type: [_sealed]: never or ["_sealed"]: never
  if (
    member.type === "TSPropertySignature" &&
    member.computed
  ) {
    const keyName =
      member.key.type === "Identifier"
        ? member.key.name
        : member.key.type === "Literal"
          ? String(member.key.value)
          : null;

    if (keyName && keyName.startsWith("_")) {
      const typeAnn = member.typeAnnotation?.typeAnnotation;
      if (typeAnn?.type === "TSNeverKeyword") {
        return true;
      }
    }
  }

  return false;
}

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

        const hasSealedSymbol = members.some(isSealedSymbolMember);

        if (!hasSealedSymbol) return;

        // Check for optional members (evolution path) — both property and method signatures
        const hasOptional = members.some(
          (member) =>
            (member.type === "TSPropertySignature" ||
              member.type === "TSMethodSignature") &&
            member.optional === true,
        );

        // 5+ total members means the interface is not considered brittle
        const hasEvolutionPath = hasOptional || members.length >= 5;

        if (!hasEvolutionPath) {
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
