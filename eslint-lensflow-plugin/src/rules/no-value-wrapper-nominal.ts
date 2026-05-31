import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "no-value-wrapper-nominal",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow single-property wrapper objects like { value: string } as manual nominal types",
    },
    messages: {
      valueWrapperNominal:
        "Type {{name}} uses a { value: string } wrapper as a nominal type. Use a branded type instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T07-structural-typing.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"valueWrapperNominal", []>) {
    return {
      TSTypeAliasDeclaration(node) {
        const { typeAnnotation, id } = node;
        if (typeAnnotation.type !== "TSTypeLiteral") return;
        if (typeAnnotation.members.length !== 1) return;

        const [member] = typeAnnotation.members;
        if (member.type !== "TSPropertySignature") return;
        if (member.key.type !== "Identifier" || member.key.name !== "value")
          return;

        const typeAnn = member.typeAnnotation?.typeAnnotation;
        if (typeAnn?.type !== "TSStringKeyword") return;

        context.report({
          node,
          messageId: "valueWrapperNominal",
          data: {
            name: id.name,
          },
        });
      },
    };
  },
});
