import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESLint } from "@typescript-eslint/utils";

const URL = knowledgeUrl("catalog/T52-literal-types.md");

export default createRule({
  name: "no-missing-as-const",
  meta: {
    type: "problem",
    docs: {
      description:
        "Enforce `as const` on object literals assigned to uppercase constant identifiers to prevent literal type widening.",
    },
    messages: {
      missingAsConst:
        "Object literal assigned to uppercase constant '{{name}}' without `as const`. String and number values will widen to `string`/`number`. Add `as const` to narrow to literal types. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"missingAsConst", []>) {
    return {
      VariableDeclarator(node) {
        const parent = node.parent;
        if (parent.type !== "VariableDeclaration" || parent.kind !== "const") {
          return;
        }

        const id = node.id;
        if (id.type !== "Identifier" || !/^[A-Z][A-Z0-9_]*$/.test(id.name)) {
          return;
        }

        const init = node.init;
        if (!init) return;

        // Check for TSSatisfiesExpression (already narrow, skip)
        if (init.type === "TSSatisfiesExpression") {
          return;
        }

        // Already `as const` — skip
        if (
          init.type === "TSTypeAssertion" &&
          init.typeAnnotation.type === "TSTypeReference" &&
          init.typeAnnotation.typeName.type === "Identifier" &&
          init.typeAnnotation.typeName.name === "const"
        ) {
          return;
        }

        // The init must be an ObjectExpression
        if (init.type !== "ObjectExpression") {
          return;
        }

        // Check that at least one property value is a string or number Literal
        const hasLiteralValue = init.properties.some(
          (prop) =>
            prop.type === "Property" &&
            prop.value.type === "Literal" &&
            (typeof prop.value.value === "string" ||
              typeof prop.value.value === "number"),
        );

        if (!hasLiteralValue) {
          return;
        }

        context.report({
          node,
          messageId: "missingAsConst",
          data: {
            name: id.name,
            url: URL,
          },
        });
      },
    };
  },
});
