import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T32-immutability-markers.md");

export default createRule({
  name: "no-shallow-readonly-array",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `readonly` on array-typed properties without inner `readonly` modifier, which allows element mutation.",
    },
    messages: {
      shallowReadonlyArray:
        "The property `{{name}}` uses `readonly` on an array type `{{type}}`, which only prevents reassignment but not element mutation. Use `readonly {{type}}` for deep immutability. See: {{url}}",
      shallowReadonlyArrayRef:
        "The property `{{name}}` uses `readonly` on an array type `Array<{{element}}>`, which only prevents reassignment but not element mutation. Use `ReadonlyArray<{{element}}>` for deep immutability. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(
    context: TSESLint.RuleContext<
      "shallowReadonlyArray" | "shallowReadonlyArrayRef",
      []
    >,
  ) {
    function getPropName(
      node: TSESTree.TSPropertySignature | TSESTree.PropertyDefinition,
      source: TSESLint.SourceCode,
    ) {
      return node.key.type === "Identifier"
        ? node.key.name
        : source.getText(node.key);
    }

    function checkShallowReadonlyArray(
      node: TSESTree.TSPropertySignature | TSESTree.PropertyDefinition,
    ) {
      if (!node.readonly) return;

      const typeAnn = node.typeAnnotation?.typeAnnotation;
      if (!typeAnn) return;

      const source = context.sourceCode;
      const propName = getPropName(node, source);

      if (typeAnn.type === "TSArrayType") {
        const typeName = source.getText(typeAnn);
        if (typeName.startsWith("readonly ")) return;
        context.report({
          node,
          messageId: "shallowReadonlyArray",
          data: { name: propName, type: typeName, url: URL },
        });
      }

      if (typeAnn.type === "TSTypeReference") {
        const tn = typeAnn.typeName;
        if (tn.type !== "Identifier" || tn.name !== "Array") return;

        const elemTypes = typeAnn.typeArguments?.params ?? [];
        const elemText = elemTypes.length
          ? elemTypes.map((e: TSESTree.Node) => source.getText(e)).join(", ")
          : "unknown";

        context.report({
          node,
          messageId: "shallowReadonlyArrayRef",
          data: { name: propName, element: elemText, url: URL },
        });
      }
    }

    return {
      TSPropertySignature(node) {
        checkShallowReadonlyArray(node);
      },
      PropertyDefinition(node) {
        checkShallowReadonlyArray(node);
      },
    };
  },
});
