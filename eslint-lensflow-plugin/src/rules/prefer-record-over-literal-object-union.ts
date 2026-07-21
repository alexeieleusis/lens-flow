import { createRule } from "../utils/rule-creator.js";
import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T31-record-types.md");

function extractPropName(
  key: TSESTree.TSPropertySignature["key"],
): string | null {
  if (key.type === "Identifier") return key.name;
  if (key.type === "Literal" && typeof key.value === "string") return key.value;
  if (key.type === "Literal" && typeof key.value === "number")
    return String(key.value);
  return null;
}

function extractLiteralValueType(
  sig: TSESTree.TSPropertySignature,
): string | null {
  const typeAnn = sig.typeAnnotation?.typeAnnotation;
  if (typeAnn?.type !== "TSLiteralType") return null;
  const lit = typeAnn.literal;
  if (
    lit.type === "Literal" &&
    lit.value !== null &&
    typeof lit.value !== "object"
  ) {
    return String(lit.value);
  }
  if (lit.type === "TemplateLiteral" && lit.quasis.length === 1) {
    return lit.quasis[0].value.cooked ?? null;
  }
  return null;
}

function extractTypeKind(typeAnn: TSESTree.TypeNode): string {
  return typeAnn.type;
}

function getPropertySigs(
  members: TSESTree.TypeElement[],
): TSESTree.TSPropertySignature[] {
  return members.filter(
    (m): m is TSESTree.TSPropertySignature => m.type === "TSPropertySignature",
  );
}

function buildPropsMap(
  literals: TSESTree.TSTypeLiteral[],
): Record<string, string[]> {
  const propsMap: Record<string, string[]> = {};
  for (const literal of literals) {
    for (const sig of getPropertySigs(literal.members)) {
      const propName = extractPropName(sig.key);
      if (!propName) continue;
      const ann = sig.typeAnnotation?.typeAnnotation;
      if (ann) {
        if (!propsMap[propName]) propsMap[propName] = [];
        propsMap[propName].push(extractTypeKind(ann));
      }
    }
  }
  return propsMap;
}

function collectLiteralValues(
  literals: TSESTree.TSTypeLiteral[],
): Record<string, Set<string>> {
  const literalValues: Record<string, Set<string>> = {};
  for (const literal of literals) {
    for (const sig of getPropertySigs(literal.members)) {
      const propName = extractPropName(sig.key);
      if (!propName) continue;
      const value = extractLiteralValueType(sig);
      if (value === null) continue;
      if (!literalValues[propName]) literalValues[propName] = new Set();
      literalValues[propName].add(value);
    }
  }
  return literalValues;
}

function keysMatch(
  firstKeys: Set<string | null>,
  members: TSESTree.TypeElement[],
): boolean {
  const sigs = getPropertySigs(members);
  const keys = new Set(sigs.map((s) => extractPropName(s.key)));
  if (keys.size !== firstKeys.size) return false;
  for (const k of keys) {
    if (k !== null && !firstKeys.has(k)) return false;
  }
  return true;
}

function allPropsSameType(propsMap: Record<string, string[]>) {
  for (const [, categories] of Object.entries(propsMap)) {
    if (!categories.every((c) => c === categories[0])) return false;
  }
  return true;
}

function hasDistinctLiteralProp(literalValues: Record<string, Set<string>>) {
  return Object.values(literalValues).some((values) => values.size >= 2);
}

export default createRule({
  name: "prefer-record-over-literal-object-union",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer a Record or discriminated union over a union of object literal types that share the same property structure but differ only in literal values",
    },
    messages: {
      preferRecord:
        "This union of object literal types shares the same property structure across members but differs only in literal values. Consider factoring into a discriminated union with a Record for variant-specific data. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"preferRecord", []>) {
    return {
      TSUnionType(node) {
        if (node.types.length < 2) return;

        const literals = node.types.filter(
          (t): t is TSESTree.TSTypeLiteral => t.type === "TSTypeLiteral",
        );
        if (literals.length !== node.types.length) return;

        // Reject members with methods, call signatures, or index signatures —
        // the rule only applies to plain data shapes (property-only objects).
        for (const literal of literals) {
          for (const member of literal.members) {
            if (member.type !== "TSPropertySignature") {
              return;
            }
          }
        }

        const firstSigs = getPropertySigs(literals[0].members);
        const firstKeys = new Set(firstSigs.map((s) => extractPropName(s.key)));

        for (const literal of literals) {
          if (!keysMatch(firstKeys, literal.members)) return;
        }

        const propsMap = buildPropsMap(literals);
        if (!allPropsSameType(propsMap)) return;

        const literalValues = collectLiteralValues(literals);
        if (hasDistinctLiteralProp(literalValues)) {
          context.report({
            node,
            messageId: "preferRecord",
            data: {
              url: URL,
            },
          });
        }
      },
    };
  },
});
