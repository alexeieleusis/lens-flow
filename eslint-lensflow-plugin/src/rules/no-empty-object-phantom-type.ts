import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESLint } from "@typescript-eslint/utils";

const URL = knowledgeUrl("catalog/T57-typestate.md");

export default createRule({
  name: "no-empty-object-phantom-type",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow empty object type literals ({}), which provide no structural distinction.",
    },
    messages: {
      emptyObjectPhantomType:
        "Type alias '{{name}}' is an empty object literal ({}), providing no structural distinction between states. Use a unique symbol brand instead (e.g., {{name}} = { readonly _state: unique symbol }). See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"emptyObjectPhantomType", []>) {
    return {
      TSTypeAliasDeclaration(node) {
        let typeNode = node.typeAnnotation;
        if (
          typeNode.type === "TSTypeLiteral" &&
          typeNode.members.length === 0
        ) {
          context.report({
            node,
            messageId: "emptyObjectPhantomType",
            data: {
              name: node.id.name,
              url: URL,
            },
          });
        }
      },
    };
  },
});
