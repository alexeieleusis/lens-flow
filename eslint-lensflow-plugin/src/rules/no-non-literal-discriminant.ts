import { createRule } from "../utils/rule-creator.js";
import type { TSESTree } from "@typescript-eslint/utils";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T01-algebraic-data-types.md");

const DISCRIMINANT_NAMES = new Set([
  "kind",
  "type",
  "status",
  "tag",
  "code",
  "discriminant",
  "dtype",
  "t",
  "variant",
  "case",
  "flavor",
]);

function getPropertyName(key: TSESTree.Expression): string | null {
  if (key.type === "Identifier") return key.name;
  if (key.type === "Literal" && typeof key.value === "string") return key.value;
  if (key.type === "Literal" && typeof key.value === "number") return String(key.value);
  return null;
}

function isWidenedKeyword(typeAnn: TSESTree.TypeNode | undefined): "string" | "number" | null {
  if (!typeAnn) return null;
  if (typeAnn.type === "TSStringKeyword") return "string";
  if (typeAnn.type === "TSNumberKeyword") return "number";
  return null;
}

function isLiteralType(typeAnn: TSESTree.TypeNode | undefined): boolean {
  if (!typeAnn) return false;
  if (typeAnn.type === "TSLiteralType") return true;
  if (typeAnn.type === "TSStringKeyword") return false;
  if (typeAnn.type === "TSNumberKeyword") return false;
  return false;
}

export default createRule({
  name: "no-non-literal-discriminant",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow discriminant-named properties (kind, type, status, etc.) in unions that use widened types (string, number) in some members while using literal types in others, when the property is present in all union members.",
    },
    messages: {
      nonLiteralDiscriminant:
        "Discriminant property `{{propName}}` uses widened type `{{type}}` instead of a literal type. Use a literal type so the union can be narrowed. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context) {
    return {
      TSUnionType(node) {
        const members = node.types;
        if (members.length < 2) return;

        const typeLiterals = members.filter(
          (m): m is TSESTree.TSTypeLiteral => m.type === "TSTypeLiteral",
        );
        if (typeLiterals.length < 2) return;

        const propMap = new Map<
          string,
          {
            widened: "string" | "number" | null;
            sig: TSESTree.TSPropertySignature;
          }[]
        >();

        for (const tl of typeLiterals) {
          for (const member of tl.members) {
            if (member.type !== "TSPropertySignature") continue;
            const propName = getPropertyName(member.key);
            if (!propName) continue;

            const widened = isWidenedKeyword(member.typeAnnotation?.typeAnnotation);
            const entry = { widened, sig: member };

            const existing = propMap.get(propName);
            if (existing) {
              existing.push(entry);
            } else {
              propMap.set(propName, [entry]);
            }
          }
        }

        for (const [propName, entries] of propMap) {
          if (!DISCRIMINANT_NAMES.has(propName)) continue;
          if (entries.length < members.length) continue;

          const hasWidened = entries.some((e) => e.widened !== null);
          const hasLiteral = entries.some(
            (e) =>
              e.widened === null &&
              isLiteralType(e.sig.typeAnnotation?.typeAnnotation),
          );

          if (!hasLiteral || !hasWidened) continue;

          for (const entry of entries) {
            if (entry.widened) {
              context.report({
                node: entry.sig,
                messageId: "nonLiteralDiscriminant",
                data: { propName, type: entry.widened, url: URL },
              });
            }
          }
        }
      },
    };
  },
});
