import type { TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { walkNodes } from "../utils/ast-helpers.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T23-type-aliases.md");

export default createRule({
  name: "no-typeof-in-type-alias",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow `typeof` inside type aliases to avoid coupling the alias to a runtime value's inferred shape",
    },
    messages: {
      typeofInAlias:
        "Type alias `{{name}}` uses `typeof`, coupling its shape to a runtime declaration. Use an explicit interface or type instead. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"typeofInAlias", []>) {
    return {
      TSTypeAliasDeclaration(node) {
        if (walkNodes(node.typeAnnotation, (n) => n.type === "TSTypeQuery")) {
          context.report({
            node,
            messageId: "typeofInAlias",
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
