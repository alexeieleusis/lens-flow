import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

const DOCS_URL =
  "https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T01-algebraic-data-types.md";

type PropEntry = {
  sig: TSESTree.TSPropertySignature;
  propName: string;
  isWidened: boolean;
  widenedType: string;
};

function extractPropName(key: TSESTree.TSPropertySignature["key"]): string | null {
  if (key?.type === "Identifier") return key.name;
  if (key?.type === "Literal") return String(key.value);
  return null;
}

function isWidenedType(typeAnn: TSESTree.TypeNode): boolean {
  return typeAnn.type === "TSStringKeyword" || typeAnn.type === "TSNumberKeyword";
}

function widenedTypeName(typeAnn: TSESTree.TypeNode): string {
  return typeAnn.type === "TSStringKeyword" ? "string" : "number";
}

function addEntry(
  propMap: Map<string, PropEntry[]>,
  propName: string,
  entry: PropEntry,
) {
  const existing = propMap.get(propName);
  if (existing) {
    existing.push(entry);
  } else {
    propMap.set(propName, [entry]);
  }
}

function propEntryFromSignature(
  sig: TSESTree.TSPropertySignature,
  propName: string,
  typeAnn: TSESTree.TypeNode,
): PropEntry | null {
  if (isWidenedType(typeAnn)) {
    return {
      sig,
      propName,
      isWidened: true,
      widenedType: widenedTypeName(typeAnn),
    };
  }
  if (typeAnn.type === "TSLiteralType") {
    return {
      sig,
      propName,
      isWidened: false,
      widenedType: "",
    };
  }
  return null;
}

function processLiteralMembers(
  literals: TSESTree.TSTypeLiteral[],
  propMap: Map<string, PropEntry[]>,
) {
  for (const member of literals) {
    for (const m of member.members) {
      if (m.type !== "TSPropertySignature") continue;
      if (!m.typeAnnotation) continue;

      const propName = extractPropName(m.key);
      if (!propName) continue;

      const entry = propEntryFromSignature(m, propName, m.typeAnnotation.typeAnnotation);
      if (entry) {
        addEntry(propMap, propName, entry);
      }
    }
  }
}

function reportMixedDiscriminants(
  propMap: Map<string, PropEntry[]>,
  context: TSESLint.RuleContext<string, unknown[]>,
) {
  for (const [, entries] of propMap) {
    const hasLiteral = entries.some((e) => !e.isWidened);
    const hasWidened = entries.some((e) => e.isWidened);
    if (!hasLiteral || !hasWidened) continue;

    for (const entry of entries) {
      if (!entry.isWidened) continue;
      context.report({
        node: entry.sig,
        messageId: "nonLiteralDiscriminant",
        data: { propName: entry.propName, type: entry.widenedType, url: DOCS_URL },
      });
    }
  }
}

export default createRule({
  name: "no-non-literal-discriminant",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow union discriminant fields that use widened types (string, number) instead of literal types.",
    },
    messages: {
      nonLiteralDiscriminant:
        "Discriminant property `{{propName}}` uses widened type `{{type}}` instead of a literal type. Use a literal type so the union can be narrowed. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"nonLiteralDiscriminant", []>) {
    return {
      TSUnionType(node) {
        const literals = node.types.filter(
          (t): t is TSESTree.TSTypeLiteral => t.type === "TSTypeLiteral",
        );
        if (literals.length < 2) return;

        const propMap = new Map<string, PropEntry[]>();
        processLiteralMembers(literals, propMap);
        reportMixedDiscriminants(propMap, context);
      },
    };
  },
});
