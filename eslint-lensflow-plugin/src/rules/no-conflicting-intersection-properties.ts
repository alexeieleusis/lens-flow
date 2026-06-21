import { AST_NODE_TYPES, TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

const PRIMITIVE_TYPES = new Set([
  "TSBooleanKeyword",
  "TSStringKeyword",
  "TSNumberKeyword",
  "TSBigIntKeyword",
  "TSNullKeyword",
  "TSUndefinedKeyword",
  "TSNeverKeyword",
]);

type PropEntry = { typeAnnotation: TSESTree.TSType };

function isConflictingTypes(a: TSESTree.TSType, b: TSESTree.TSType): boolean {
  const typeA = a.type;
  const typeB = b.type;

  if (PRIMITIVE_TYPES.has(typeA) && PRIMITIVE_TYPES.has(typeB)) {
    return typeA !== typeB;
  }

  if (typeA === "TSLiteralType" && typeB === "TSLiteralType") {
    const litA = (a as TSESTree.TSLiteralType).literal;
    const litB = (b as TSESTree.TSLiteralType).literal;
    return litA.value !== litB.value;
  }

  return false;
}

function extractPropertyName(
  key: TSESTree.TSPropertySignature["key"],
): string | undefined {
  if (key.type === AST_NODE_TYPES.Identifier) {
    return key.name;
  }
  if (key.type === AST_NODE_TYPES.Literal) {
    const val = (key as TSESTree.Literal).value;
    if (typeof val === "string") return val;
  }
  return undefined;
}

function collectProperties(
  members: TSESTree.TSTypeLiteral["members"],
): Map<string, PropEntry[]> {
  const propMap = new Map<string, PropEntry[]>();

  for (const member of members) {
    if (member.type !== AST_NODE_TYPES.TSPropertySignature) continue;

    const m = member;
    const propName = extractPropertyName(m.key);
    if (propName === undefined) continue;
    const ta = m.typeAnnotation?.typeAnnotation;
    if (!ta) continue;

    const entries = propMap.get(propName) ?? [];
    entries.push({ typeAnnotation: ta });
    propMap.set(propName, entries);
  }

  return propMap;
}

function findConflicts(propMap: Map<string, PropEntry[]>): string[] {
  const conflicts: string[] = [];

  for (const [propName, entries] of propMap) {
    if (entries.length < 2) continue;

    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        if (isConflictingTypes(entries[i].typeAnnotation, entries[j].typeAnnotation)) {
          conflicts.push(propName);
          break;
        }
      }
      if (conflicts.includes(propName)) break;
    }
  }

  return conflicts;
}

export default createRule({
  name: "no-conflicting-intersection-properties",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow conflicting property types in intersection types that produce `never`. Note: only checks TSPropertySignature; method (TSMethodSignature) and index (TSIndexSignature) conflicts are not detected.",
    },
    messages: {
      conflict:
        "Property '{{prop}}' has conflicting types in intersection members. This produces `never` for the property. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T02-union-intersection.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"conflict", []>) {
    return {
      TSIntersectionType(node) {
        const propMap = new Map<string, PropEntry[]>();
        for (const member of node.types) {
          if (member.type === AST_NODE_TYPES.TSTypeLiteral) {
            const memberMap = collectProperties(member.members);
            for (const [prop, entries] of memberMap) {
              const existing = propMap.get(prop) ?? [];
              existing.push(...entries);
              propMap.set(prop, existing);
            }
          }
        }

        const conflicts = findConflicts(propMap);
        if (conflicts.length > 0) {
          context.report({
            node,
            messageId: "conflict",
            data: { prop: conflicts.join(", ") },
          });
        }
      },
    };
  },
});
