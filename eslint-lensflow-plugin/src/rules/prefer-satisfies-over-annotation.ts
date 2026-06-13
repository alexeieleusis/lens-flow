import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "prefer-satisfies-over-annotation",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer `satisfies T` over `: T` for const bindings initialized with object literals containing literal values",
    },
    messages: {
      preferSatisfies:
        "Use `satisfies {{type}}` instead of `: {{type}}` to preserve literal types. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T52-literal-types.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"preferSatisfies", []>) {
    return {
      VariableDeclarator(node) {
        const parent = node.parent;
        if (
          parent?.type !== "VariableDeclaration" ||
          parent.kind !== "const"
        ) {
          return;
        }

        const init = node.init;
        if (!init) return;

        if (init.type === "TSSatisfiesExpression") return;

        if (init.type !== "ObjectExpression") return;

        const hasLiteralValues = init.properties.some(
          (prop) =>
            prop.type === "Property" &&
            !prop.method &&
            prop.value.type === "Literal",
        );
        if (!hasLiteralValues) return;

        if (!node.id.typeAnnotation) return;

        const typeAnnotation = node.id.typeAnnotation.typeAnnotation;
        let typeName = "?";
        if (typeAnnotation.type === "TSTypeReference") {
          const typeNameNode = typeAnnotation.typeName;
          if (typeNameNode.type === "Identifier") {
            typeName = typeNameNode.name;
          }
        } else if (typeAnnotation.type === "TSUnionType") {
          typeName = typeAnnotation.types
            .map((t) => {
              if (t.type === "TSLiteralType") {
                const lit = t.literal;
                if (lit.type === "Literal") return String(lit.value);
              }
              if (t.type === "TSTypeReference" && t.typeName.type === "Identifier")
                return t.typeName.name;
              return "?";
            })
            .join(" | ");
        }

        context.report({
          node,
          messageId: "preferSatisfies",
          data: { type: typeName },
        });
      },
    };
  },
});
