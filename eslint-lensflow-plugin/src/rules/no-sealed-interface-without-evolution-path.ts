import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

const URL = knowledgeUrl("usecases/UC10-encapsulation.md");

function isIndexSignatureSealed(
  member: TSESTree.TSInterfaceBody["body"][number],
): boolean {
  if (member.type !== "TSIndexSignature" || member.parameters.length === 0) {
    return false;
  }
  const param = member.parameters[0];
  if (param.type !== "Identifier") return false;
  const paramType = param.typeAnnotation?.typeAnnotation;
  if (!paramType) return false;

  if (paramType.type === "TSTypeOperator" && paramType.operator === "unique") {
    return true;
  }
  return paramType.type === "TSTypeQuery";
}

function isComputedSealedProperty(
  member: TSESTree.TSInterfaceBody["body"][number],
): boolean {
  if (member.type !== "TSPropertySignature" || !member.computed) return false;

  let keyName: string | null = null;
  if (member.key.type === "Identifier") {
    keyName = member.key.name;
  } else if (member.key.type === "Literal") {
    keyName = String(member.key.value);
  }
  if (!keyName?.startsWith("_")) return false;

  return member.typeAnnotation?.typeAnnotation?.type === "TSNeverKeyword";
}

function isSealedSymbolMember(
  member: TSESTree.TSInterfaceBody["body"][number],
): boolean {
  return isIndexSignatureSealed(member) || isComputedSealedProperty(member);
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
        "Interface '{{name}}' uses a sealed symbol but has no optional members for backward-compatible evolution. Add optional members or use a class. See: {{url}}",
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
              url: URL,
            },
          });
        }
      },
    };
  },
});
