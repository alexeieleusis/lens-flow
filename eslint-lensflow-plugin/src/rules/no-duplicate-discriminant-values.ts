import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl(
  "catalog/T01-algebraic-data-types.md",
  "2. Duplicate discriminant values",
);

function extractPropName(key: TSESTree.Property["key"]): string | null {
  if (key.type === "Identifier") return key.name;
  if (key.type === "Literal") return String(key.value);
  return null;
}

function extractDiscriminantValue(
  typeNode: TSESTree.TypeNode | undefined,
): string | null {
  if (!typeNode) return null;

  if (typeNode.type === "TSLiteralType") {
    const lit = typeNode.literal;
    if (lit.type === "Literal") return String(lit.value);
    if (lit.type === "TemplateLiteral" && lit.quasis.length === 1) {
      return lit.quasis[0].value.cooked ?? null;
    }
  }

  if (typeNode.type === "TSNullKeyword") return "null";
  if (typeNode.type === "TSUndefinedKeyword") return "undefined";

  if (typeNode.type === "TSTypeReference") {
    return extractTypeRefName(typeNode.typeName);
  }

  return null;
}

function extractTypeRefName(
  typeName:
    TSESTree.Identifier | TSESTree.ThisExpression | TSESTree.TSQualifiedName,
): string | null {
  if (typeName.type === "Identifier") return typeName.name;
  if (typeName.type === "ThisExpression") return "this";
  if (typeName.type === "TSQualifiedName") {
    const left = extractTypeRefName(typeName.left);
    if (left === null) return null;
    return `${left}.${typeName.right.name}`;
  }
  return null;
}

function isDiscriminantCandidate(
  member: TSESTree.TypeElement,
): member is TSESTree.TSPropertySignature & {
  typeAnnotation: TSESTree.TSTypeAnnotation;
} {
  if (member.type !== "TSPropertySignature") return false;
  if (!member.typeAnnotation) return false;
  return true;
}

function addDiscriminant(
  discriminants: Map<string, TSESTree.TSPropertySignature[]>,
  member: TSESTree.TypeElement,
) {
  if (!isDiscriminantCandidate(member)) return;

  const propName = extractPropName(member.key);
  if (propName === null) return;

  const value = extractDiscriminantValue(member.typeAnnotation.typeAnnotation);
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
  const value =
    extractDiscriminantValue(sig.typeAnnotation?.typeAnnotation) ?? "?";

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
