import { createRule } from "../utils/rule-creator.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

const brandPattern = /^(.*_*brand|brand.*)$/i;

function hasBrandMarker(member: TSESTree.TypeNode): boolean {
  if (member.type !== "TSTypeLiteral") return false;
  return member.members.some((m) => {
    if (m.type !== "TSPropertySignature") return false;
    const key = m.key;
    if (key.type === "Identifier") return brandPattern.test(key.name);
    if (key.type === "Literal" && typeof key.value === "string") return brandPattern.test(key.value);
    return false;
  });
}

export default createRule({
  name: "no-over-branding-uc02",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow over-branding string or number fields in a single module",
    },
    messages: {
      overBranding:
        "Found {{count}} branded {{primitive}} types (threshold: {{max}}). Brands should be reserved for values that are easily confused, not every field. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC02-domain-modeling.md",
    },
    schema: [
      {
        type: "object",
        properties: {
          maxBrandsPerPrimitive: {
            type: "number",
            minimum: 1,
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
  },
  defaultOptions: [{ maxBrandsPerPrimitive: 3 }],
  create(context: TSESLint.RuleContext<"overBranding", [{ maxBrandsPerPrimitive: number }]>) {
    const [{ maxBrandsPerPrimitive } = { maxBrandsPerPrimitive: 3 }] =
      context.options ?? [{ maxBrandsPerPrimitive: 3 }];

    const brandedAliases: Array<{
      node: TSESTree.TSTypeAliasDeclaration;
      primitive: "string" | "number";
    }> = [];

    return {
      "Program:exit"() {
        const byPrimitive = new Map<"string" | "number", typeof brandedAliases>();
        for (const b of brandedAliases) {
          byPrimitive.set(b.primitive, [...(byPrimitive.get(b.primitive) || []), b]);
        }
        for (const [primitive, group] of byPrimitive) {
          if (group.length > maxBrandsPerPrimitive) {
            for (const branded of group) {
              context.report({ node: branded.node, messageId: "overBranding", data: { count: String(group.length), primitive, max: String(maxBrandsPerPrimitive) } });
            }
          }
        }
      },

      TSTypeAliasDeclaration(node) {
        if (node.parent?.type !== "Program") return;
        if (node.typeAnnotation.type !== "TSIntersectionType") return;

        const members = node.typeAnnotation.types;
        let primitive: "string" | "number" | null = null;

        for (const member of members) {
          if (member.type === "TSStringKeyword") {
            primitive = "string";
            break;
          }
          if (member.type === "TSNumberKeyword") {
            primitive = "number";
            break;
          }
        }

        if (primitive && members.length >= 2 && members.some(hasBrandMarker)) {
          brandedAliases.push({ node, primitive });
        }
      },
    };
  },
});
