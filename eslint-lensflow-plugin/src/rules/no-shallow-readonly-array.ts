import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

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
        "The property `{{name}}` uses `readonly` on an array type `{{type}}`, which only prevents reassignment but not element mutation. Use `readonly {{type}}` for deep immutability. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T32-immutability-markers.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"shallowReadonlyArray", []>) {
    function checkShallowReadonlyArray(
      node: TSESTree.TSPropertySignature | TSESTree.PropertyDefinition,
    ) {
      if (!node.readonly) return;

      const typeAnn = node.typeAnnotation?.typeAnnotation;
      if (typeAnn?.type !== "TSArrayType") return;

      const source = context.sourceCode;
      const typeName = source.getText(typeAnn);
      if (typeName.startsWith("readonly ")) return;
      const propName =
        node.key.type === "Identifier" ? node.key.name : source.getText(node.key);

      context.report({
        node,
        messageId: "shallowReadonlyArray",
        data: {
          name: propName,
          type: typeName,
        },
      });
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
