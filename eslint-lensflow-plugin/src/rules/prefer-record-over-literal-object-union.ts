import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

type PropKey =
  | { type: "Identifier"; name: string }
  | { type: "Literal"; value: string | number };

type LiteralMember = {
  type: "TSTypeLiteral";
  members: Array<{
    type: "TSPropertySignature";
    key: PropKey;
    typeAnnotation?: {
      typeAnnotation: { type: string };
    };
  }>;
};

type PropertySig = {
  type: "TSPropertySignature";
  key: PropKey;
  typeAnnotation?: {
    typeAnnotation: { type: string };
  };
};

function getPropertySigs(members: LiteralMember["members"]) {
  return members.filter(
    (m): m is PropertySig => m.type === "TSPropertySignature",
  );
}

function getPropertyKey(sig: PropertySig) {
  if (sig.key.type === "Identifier") return sig.key.name;
  if (sig.key.type === "Literal" && typeof sig.key.value === "string") return sig.key.value;
  return null;
}

function buildPropsMap(literalMembers: LiteralMember[]) {
  const propsMap: Record<string, string[]> = {};
  for (const member of literalMembers) {
    for (const sig of getPropertySigs(member.members)) {
      const propName = getPropertyKey(sig);
      if (!propName) continue;
      const ann = sig.typeAnnotation?.typeAnnotation;
      if (ann) {
        if (!propsMap[propName]) propsMap[propName] = [];
        propsMap[propName].push(ann.type);
      }
    }
  }
  return propsMap;
}

function collectLiteralValue(sig: PropertySig, literalValues: Record<string, Set<string>>) {
  const propName = getPropertyKey(sig);
  if (!propName) return;
  const ann = sig.typeAnnotation?.typeAnnotation;
  if (ann?.type !== "TSLiteralType") return;
  if (!literalValues[propName]) literalValues[propName] = new Set();
  const lit = (ann as unknown as { literal: { value?: unknown } }).literal;
  if (lit?.value !== undefined && typeof lit.value !== "object") {
    literalValues[propName].add(String(lit.value as string | number | boolean));
  }
}

function collectLiteralValues(literalMembers: LiteralMember[]) {
  const literalValues: Record<string, Set<string>> = {};
  for (const member of literalMembers) {
    for (const sig of getPropertySigs(member.members)) {
      collectLiteralValue(sig, literalValues);
    }
  }
  return literalValues;
}

function keysMatch(firstKeys: Set<string | null>, sigs: ReturnType<typeof getPropertySigs>) {
  const keys = new Set(sigs.map((m) => getPropertyKey(m)));
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
        "This union of object literal types shares the same property structure across members but differs only in literal values. Consider factoring into a discriminated union with a Record for variant-specific data. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T31-record-types.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"preferRecord", []>) {
    return {
      TSUnionType(node) {
        if (node.types.length < 2) return;

        const allLiterals = node.types.every((m) => m.type === "TSTypeLiteral");
        if (!allLiterals) return;

        const literalMembers = node.types as unknown as LiteralMember[];
        const firstKeys = new Set(getPropertySigs(literalMembers[0].members).map((m) => getPropertyKey(m)));

        for (const member of literalMembers) {
          if (!keysMatch(firstKeys, getPropertySigs(member.members))) return;
        }

        const propsMap = buildPropsMap(literalMembers);
        if (!allPropsSameType(propsMap)) return;

        const literalValues = collectLiteralValues(literalMembers);
        if (hasDistinctLiteralProp(literalValues)) {
          context.report({
            node,
            messageId: "preferRecord",
          });
        }
      },
    };
  },
});
