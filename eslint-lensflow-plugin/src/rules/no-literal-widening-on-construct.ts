import ts from "typescript";
import { ESLintUtils, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

export default createRule({
  name: "no-literal-widening-on-construct",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow object literals assigned to discriminated-union variables without `as const`, `satisfies`, or explicit type annotation",
     },
    messages: {
      widen:
        "Object literal assigned to discriminated-union variable '{{varName}}' without type narrowing. The discriminant '{{discriminant}}' will widen to a broader type. Use `as const`, `satisfies`, or an explicit type annotation. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T01-algebraic-data-types.md",
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
