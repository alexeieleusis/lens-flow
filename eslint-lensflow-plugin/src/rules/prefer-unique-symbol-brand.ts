import type { TSESTree } from "@typescript-eslint/types";
import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T03-newtypes-opaque.md");

const BRAND_PATTERN = /^__?(?:brand|Branded)$|Brand$/;

function getKeyIdentifier(key: TSESTree.Property["key"]): string | null {
  if (key.type === "Identifier") return key.name;
  if (key.type === "Literal" && typeof key.value === "string") return key.value;
  return null;
}

function isStringLiteralBrand(typeAnn: TSESTree.TypeNode | undefined): boolean {
  return (
    typeAnn?.type === "TSLiteralType" &&
    typeAnn.literal.type === "Literal" &&
    typeof typeAnn.literal.value === "string"
  );
}

function reportStringBrand(
  context: Parameters<ReturnType<typeof createRule>["create"]>[0],
  node: TSESTree.TSTypeAliasDeclaration,
  brandName: string,
) {
  context.report({
    node,
    messageId: "stringBrandForgery",
    data: { brandName, url: URL },
  });
}

export default createRule({
  name: "prefer-unique-symbol-brand",
  meta: {
    type: "problem",
    docs: {
      description:
        "Prefer `unique symbol` brands over string-literal brands to prevent forgery via `as` cast. Detects brand properties named `brand`, `_brand`, `__brand`, `Branded`, `_Branded`, `__Branded`, or any name ending in `Brand` (e.g. `orderBrand`, `MoneyBrand`).",
    },
    messages: {
      stringBrandForgery:
        "String-literal brand '{{brandName}}' can be forged via `as` cast. Use a `unique symbol` brand instead. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"stringBrandForgery", []>) {
    return {
      TSTypeAliasDeclaration(node) {
        if (node.typeAnnotation.type !== "TSIntersectionType") return;

        for (const memberType of node.typeAnnotation.types) {
          if (memberType.type !== "TSTypeLiteral") continue;

          for (const member of memberType.members) {
            if (member.type !== "TSPropertySignature") continue;

            const keyName = getKeyIdentifier(member.key);
            if (!keyName || !BRAND_PATTERN.test(keyName)) continue;

            if (isStringLiteralBrand(member.typeAnnotation?.typeAnnotation)) {
              reportStringBrand(context, node, keyName);
              return;
            }
          }
        }
      },
    };
  },
});
