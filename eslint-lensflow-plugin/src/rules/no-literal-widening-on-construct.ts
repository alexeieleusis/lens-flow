import ts from "typescript";
import { ESLintUtils, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

const DISCRIMINANT_NAMES = new Set([
  "kind",
  "type",
  "status",
  "tag",
  "discriminator",
  "case",
  "variant",
  "eventType",
  "messageType",
  "actionType",
  "state",
  "role",
  "flavor",
]);

export default createRule({
  name: "no-literal-widening-on-construct",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow object literals whose string literal properties widen to `string` without `as const`, `satisfies`, or explicit type annotation",
     },
    messages: {
      widen:
        "Object literal assigned to '{{varName}}' without type narrowing. The property '{{discriminant}}' will widen from a string literal to `string`. Use `as const`, `satisfies`, or an explicit type annotation. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T01-algebraic-data-types.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"widen", []>) {
    const parserServices = ESLintUtils.getParserServices(context);
    if (!parserServices.program) return {};

    return {
      VariableDeclarator(node: any) {
        if (node.init?.type !== "ObjectExpression") return;
        if (node.id.type !== "Identifier") return;

        // Skip if there's an explicit type annotation — narrowing is already handled
        if (node.id.typeAnnotation) return;

        // Skip if wrapped in `satisfies`
        if (node.parent?.type === "VariableDeclarator" &&
            node.init.parent?.type === "TSSatisfiesExpression") {
          return;
        }

        // Skip if wrapped in `as const`
        if (node.init.parent?.type === "TSAsExpression" &&
            node.init.parent.typeAnnotation.type === "TSTypeReference" &&
            node.init.parent.typeAnnotation.typeName.type === "Identifier" &&
            node.init.parent.typeAnnotation.typeName.name === "const") {
          return;
        }

        for (const prop of node.init.properties) {
          if (prop.type !== "Property") continue;

          // Check for string literal values (potential DU discriminants)
          if (
            prop.value.type !== "Literal" ||
            typeof prop.value.value !== "string"
          ) continue;

          // Check if the literal has widened in its object context
          const propType = parserServices.getTypeAtLocation(prop);
          const isNarrowed = (propType.flags & ts.TypeFlags.StringLiteral) !== 0;

          if (!isNarrowed) {
            const propName =
              prop.key.type === "Identifier"
                ? prop.key.name
                : prop.key.value;

            // Only flag properties with discriminant-like names
            if (!DISCRIMINANT_NAMES.has(propName)) continue;

            context.report({
              node,
              messageId: "widen",
              data: {
                varName: node.id.name,
                discriminant: propName,
              },
            });
            return;
          }
        }
      },
    };
  },
});
