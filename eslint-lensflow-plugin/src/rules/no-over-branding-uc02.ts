import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

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
        "Found {{count}} branded {{primitive}} types (threshold: {{max}}). Brands should be reserved for values that are easily confused, not every field. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/usecases/UC02-domain-modeling.md",
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
      node: import("@typescript-eslint/types").TSESTree.TSTypeAliasDeclaration;
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

        if (primitive && members.length >= 2) {
          brandedAliases.push({ node, primitive });
        }
      },
    };
  },
});
