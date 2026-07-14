import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

export default createRule({
  name: "prefer-record-over-index-signature",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer Record<K, V> over an interface or type literal containing only an index signature",
    },
    messages: {
      preferRecord:
        "Use Record<K, V> instead of an inline index signature. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T31-record-types.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"preferRecord", []>) {
    function checkSingleIndexSignature(
      members: TSESTree.TypeElement[],
      reportNode: TSESTree.Node,
    ) {
      if (members.length !== 1) return;
      const member = members[0];
      if (member.type !== "TSIndexSignature") return;
      if (member.readonly) return;
      const param = member.parameters[0];
      const typeAnn = (param as TSESTree.Identifier).typeAnnotation?.typeAnnotation;
      if (
        typeAnn &&
        (typeAnn.type === "TSStringKeyword" || typeAnn.type === "TSNumberKeyword")
      ) {
        context.report({
          node: reportNode,
          messageId: "preferRecord",
        });
      }
    }

    return {
      TSInterfaceBody(node) {
        checkSingleIndexSignature(node.body, node.parent);
      },

      TSTypeLiteral(node) {
        checkSingleIndexSignature(node.members, node);
      },
    };
  },
});
