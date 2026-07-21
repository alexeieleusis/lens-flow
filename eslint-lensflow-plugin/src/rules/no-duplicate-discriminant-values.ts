import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T01-algebraic-data-types.md");

function extractPropName(key: TSESTree.Property["key"]): string | null {
  if (key.type === "Identifier") return key.name;
  if (key.type === "Literal") return String(key.value);
  return null;
}

function extractLiteralValue(
  literal: TSESTree.TypeNode | undefined,
): string | null {
  if (!literal) return null;
  if (literal.type !== "TSLiteralType") return null;

  const lit = literal.literal;
  if (lit.type === "Literal") return String(lit.value);
  if (lit.type === "TemplateLiteral" && lit.quasis.length === 1) {
    return lit.quasis[0].value.cooked ?? null;
  }
  return null;
}

function isDiscriminantCandidate(
  member: TSESTree.TypeElement,
): member is TSESTree.TSPropertySignature & {
  typeAnnotation: { typeAnnotation: TSESTree.TSLiteralType };
} {
  if (member.type !== "TSPropertySignature") return false;
  if (!member.typeAnnotation) return false;
  return member.typeAnnotation.typeAnnotation.type === "TSLiteralType";
}

function addDiscriminant(
  discriminants: Map<string, TSESTree.TSPropertySignature[]>,
  member: TSESTree.TypeElement,
) {
  if (!isDiscriminantCandidate(member)) return;

  const propName = extractPropName(member.key);
  if (propName === null) return;

  const value = extractLiteralValue(member.typeAnnotation.typeAnnotation);
  if (value === null) return;

  const key = JSON.stringify([propName, value]);
  const existing = discriminants.get(key);
  if (existing) {
    existing.push(member);
  } else {
    discriminants.set(key, [member]);
  }
}

function buildDiscriminantsMap(
  types: TSESTree.TSTypeLiteral[],
): Map<string, TSESTree.TSPropertySignature[]> {
  const discriminants = new Map<string, TSESTree.TSPropertySignature[]>();

  for (const memberType of types) {
    for (const member of memberType.members) {
      addDiscriminant(discriminants, member);
    }
  }

  return discriminants;
}

function reportDuplicate(
  context: Parameters<ReturnType<typeof createRule>["create"]>[0],
  sig: TSESTree.TSPropertySignature,
) {
  const propName = extractPropName(sig.key) ?? "?";
  const value = extractLiteralValue(sig.typeAnnotation?.typeAnnotation) ?? "?";

  context.report({
    node: sig,
    messageId: "duplicateDiscriminant",
    data: { propName, value, url: URL },
  });
}

function reportDuplicates(
  context: Parameters<ReturnType<typeof createRule>["create"]>[0],
  discriminants: Map<string, TSESTree.TSPropertySignature[]>,
) {
  for (const [, sigs] of discriminants) {
    if (sigs.length < 2) continue;
    for (const sig of sigs) {
      reportDuplicate(context, sig);
    }
  }
}

export default createRule({
  name: "no-duplicate-discriminant-values",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow discriminated union members that share the same discriminant literal value.",
    },
    messages: {
      duplicateDiscriminant:
        "Discriminant property `{{propName}}` has duplicate value `{{value}}` across union members. Each variant must use a unique discriminant value. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"duplicateDiscriminant", []>) {
    return {
      TSUnionType(node) {
        const types = node.types.filter(
          (t): t is TSESTree.TSTypeLiteral => t.type === "TSTypeLiteral",
        );

        if (types.length < 2) return;

        const discriminants = buildDiscriminantsMap(types);
        reportDuplicates(context, discriminants);
      },
    };
  },
});
