import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESLint } from "@typescript-eslint/utils";

const URL = knowledgeUrl("catalog/T52-literal-types.md");

export default createRule({
  name: "no-template-literal-type-explosion",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow template literal types that interpolate multiple large union types producing combinatorial explosion",
    },
    messages: {
      cartesianProduct:
        "Template literal type produces an estimated Cartesian product of {{product}} (max: {{max}}). Split into smaller template types or inline fewer unions. See: {{url}}",
    },
    schema: [
      {
        type: "object",
        properties: {
          maxProduct: {
            type: "number",
            minimum: 2,
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
  },
  defaultOptions: [{ maxProduct: 20 }],
  create(context: TSESLint.RuleContext<"cartesianProduct", [{ maxProduct?: number }]>) {
    const { maxProduct = 20 } = context.options[0] ?? {};

    const typeAliasMap = new Map<string, number>();

    return {
      TSTypeAliasDeclaration(node) {
        if (
          node.typeAnnotation.type === "TSUnionType" &&
          node.typeAnnotation.types.every(
            (member) => member.type === "TSLiteralType",
          )
        ) {
          typeAliasMap.set(
            node.id.name,
            node.typeAnnotation.types.length,
          );
        }
      },

      TSTemplateLiteralType(node) {
        const counts: number[] = [];

        for (const t of node.types) {
          if (t.type === "TSTypeReference") {
            let typeName: string | null = null;
            if (t.typeName.type === "Identifier") {
              typeName = t.typeName.name;
            } else if (t.typeName.type === "TSQualifiedName") {
              typeName = t.typeName.right.name;
            }
            if (typeName && typeAliasMap.has(typeName)) {
              counts.push(typeAliasMap.get(typeName)!);
            }
          }
        }

        if (counts.length > 1) {
          const product = counts.reduce((a, b) => a * b, 1);
          if (product > maxProduct) {
            context.report({
              node,
              messageId: "cartesianProduct",
              data: {
                product: String(product),
                max: String(maxProduct),
                url: URL,
              },
            });
          }
        }
      },
    };
  },
});
