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

type PropEntry = { typeAnnotation: TSESTree.TypeNode };

function literalValueEquals(a: unknown, b: unknown): boolean {
  if (typeof a !== typeof b) return false;
  if (typeof a === "bigint") {
    return a === b;
  }
  if (typeof a === "object" && a !== null && b !== null) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return a === b;
}

function literalMatchesPrimitive(litVal: unknown, primType: string): boolean {
  switch (primType) {
    case "TSStringKeyword":
      return typeof litVal === "string";
    case "TSNumberKeyword":
      return typeof litVal === "number";
    case "TSBooleanKeyword":
      return typeof litVal === "boolean";
    case "TSBigIntKeyword":
      return typeof litVal === "bigint";
    case "TSNullKeyword":
      return litVal === null;
    case "TSUndefinedKeyword":
      return litVal === undefined;
    default:
      return false;
  }
}

function isConflictingTypes(a: TSESTree.TypeNode, b: TSESTree.TypeNode): boolean {
  const typeA = a.type;
  const typeB = b.type;

  if (PRIMITIVE_TYPES.has(typeA) && PRIMITIVE_TYPES.has(typeB)) {
    return typeA !== typeB;
  }

  if (typeA === "TSLiteralType" && typeB === "TSLiteralType") {
    const litA = (a as TSESTree.TSLiteralType).literal;
    const litB = (b as TSESTree.TSLiteralType).literal;
    if (litA.type !== "Literal" || litB.type !== "Literal") return false;
    return !literalValueEquals(litA.value, litB.value);
  }

  if (PRIMITIVE_TYPES.has(typeA) && typeB === "TSLiteralType") {
    const lit = (b as TSESTree.TSLiteralType).literal;
    if (lit.type !== "Literal") return false;
    return !literalMatchesPrimitive(lit.value, typeA);
  }

  if (typeA === "TSLiteralType" && PRIMITIVE_TYPES.has(typeB)) {
    const lit = a.literal;
    if (lit.type !== "Literal") return false;
    return !literalMatchesPrimitive(lit.value, typeB);
  }

  if (typeA === "TSTypeLiteral" && typeB === "TSTypeLiteral") {
    const mapA = collectProperties(a.members);
    const mapB = collectProperties(b.members);
    for (const [prop, entriesA] of mapA) {
      const entriesB = mapB.get(prop);
      if (!entriesB) continue;
      for (const ea of entriesA) {
        for (const eb of entriesB) {
          if (isConflictingTypes(ea.typeAnnotation, eb.typeAnnotation)) {
            return true;
          }
        }
      }
    }
    return false;
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
        "Disallow conflicting property types in intersection types that produce `never`. Detects: different primitive types (e.g. `string` vs `number`), primitive vs incompatible literal (e.g. `string` vs `42`), different literal values (including object/array literals), and nested object type property conflicts. Note: only checks TSPropertySignature with static string or numeric literal keys; method (TSMethodSignature), index (TSIndexSignature), and computed property keys (e.g. `[symbolKey]`) are not detected.",
    },
    messages: {
      conflict:
        "Property '{{prop}}' has conflicting types in intersection members. This produces `never` for the property. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T02-union-intersection.md",
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
