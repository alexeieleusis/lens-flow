import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESLint } from "@typescript-eslint/utils";

const URL = knowledgeUrl(
  "catalog/T57-typestate.md",
  "B. Using plain type aliases instead of brands",
);

export default createRule({
  name: "no-empty-object-phantom-type",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow empty object type literals ({}), which provide no structural distinction between phantom state markers.",
    },
    messages: {
      emptyObjectPhantomType:
        "Type alias '{{name}}' is an empty object literal ({}), providing no structural distinction between states. Brand the state marker (e.g., type {{name}} = Brand<\"{{name}}\">) AND ensure the generic type references its parameter in a member (e.g., declare private readonly _state: S). See: {{url}}",
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
