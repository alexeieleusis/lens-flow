import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "no-string-discriminant-instead-of-union",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow interfaces with a string-literal-union discriminant and other fields — use a discriminated union type instead for exhaustiveness checking.",
    },
    messages: {
      stringDiscriminant:
        "Interface '{{name}}' uses a string-literal-union discriminant ('{{discriminant}}') with other fields. Use a discriminated union type instead to get compile-time exhaustiveness checking. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC14-extensibility.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"stringDiscriminant", []>) {
    return {
      TSInterfaceBody(node) {
        if (node.body.length <= 1) return;

        const discriminantProp = node.body.find(
          (member) =>
            member.type === "TSPropertySignature" &&
            !member.optional &&
            member.typeAnnotation?.typeAnnotation?.type === "TSUnionType" &&
            member.typeAnnotation.typeAnnotation.types.every(
              (t) =>
                t.type === "TSLiteralType" &&
                t.literal.type === "Literal" &&
                typeof t.literal.value === "string",
            ),
        );

        if (discriminantProp?.type === "TSPropertySignature") {
          let propName: string;
          if (discriminantProp.key.type === "Identifier") {
            propName = discriminantProp.key.name;
          } else {
            propName =
              discriminantProp.key.type === "Literal"
                ? String(discriminantProp.key.value)
                : "?";
          }

          const ifaceName =
            node.parent?.type === "TSInterfaceDeclaration" &&
            node.parent?.id?.type === "Identifier"
              ? node.parent.id.name
              : "?";

          context.report({
            node,
            messageId: "stringDiscriminant",
            data: {
              name: ifaceName,
              discriminant: propName,
            },
          });
        }
      },
    };
  },
});
