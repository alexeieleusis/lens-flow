import { createRule } from "../utils/rule-creator.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

function getPropertyKey(
  key: TSESTree.TSPropertySignature["key"],
): string | null {
  if (key.type === "Identifier") return key.name;
  if (key.type === "Literal" && typeof key.value === "string") return key.value;
  return null;
}

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
        "Type {{name}} uses a { value: string } wrapper as a nominal type. Use a branded type instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/f5ab7f35de4cc4e292500398c8b2f6edab96c2db/plugin/skills/typescript/catalog/T07-structural-typing.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"valueWrapperNominal", []>) {
    function checkSingleValueProperty(
      node: TSESTree.TSTypeAliasDeclaration | TSESTree.TSInterfaceDeclaration,
      members: readonly TSESTree.TypeElement[],
    ) {
      if (members.length !== 1) return;

      const [member] = members;
      if (member.type !== "TSPropertySignature") return;
      if (getPropertyKey(member.key) !== "value") return;

      const typeAnn = member.typeAnnotation?.typeAnnotation;
      if (typeAnn?.type !== "TSStringKeyword") return;

      const name = node.id.name;

      context.report({
        node,
        messageId: "valueWrapperNominal",
        data: { name },
      });
    }

    return {
      TSTypeAliasDeclaration(node) {
        const { typeAnnotation } = node;
        if (typeAnnotation.type !== "TSTypeLiteral") return;
        checkSingleValueProperty(node, typeAnnotation.members);
      },
      TSInterfaceDeclaration(node) {
        checkSingleValueProperty(node, node.body.body);
      },
    };
  },
});
