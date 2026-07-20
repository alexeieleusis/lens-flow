import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

const URL = knowledgeUrl("catalog/T07-structural-typing.md");

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
        "Type {{name}} uses a { value: string } wrapper as a nominal type. Use a branded type instead. See: {{url}}",
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
        data: { name, url: URL },
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
