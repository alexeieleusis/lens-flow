import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "no-empty-object-phantom-type",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow empty object type aliases ({}) used as phantom or state types, which provide no structural distinction.",
    },
    messages: {
      emptyObjectPhantomType:
        "Type alias '{{name}}' is an empty object literal ({}), providing no structural distinction between states. Use a unique symbol brand instead (e.g., {{name}} = { readonly _state: unique symbol }). See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T57-typestate.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"emptyObjectPhantomType", []>) {
    return {
      TSTypeAliasDeclaration(node) {
        if (
          node.typeAnnotation.type === "TSTypeLiteral" &&
          node.typeAnnotation.members.length === 0
        ) {
          context.report({
            node,
            messageId: "emptyObjectPhantomType",
            data: {
              name: node.id.name,
            },
          });
        }
      },
    };
  },
});
