import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "no-primitive-type-alias",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow type aliases that are transparent wrappers around a single primitive keyword",
    },
    messages: {
      primitiveAlias:
        "Type alias \"{{name}}\" is a transparent alias for \"{{primitive}}\". Use the primitive directly or a branded type for nominal distinction. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T23-type-aliases.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"primitiveAlias", []>) {
    return {
      TSTypeAliasDeclaration(node) {
        const ann = node.typeAnnotation;
        const primitiveTypes = new Set([
          "TSStringKeyword",
          "TSNumberKeyword",
          "TSBooleanKeyword",
          "TSVoidKeyword",
          "TSUndefinedKeyword",
          "TSNullKeyword",
          "TSSymbolKeyword",
          "TSBigIntKeyword",
        ]);
        if (primitiveTypes.has(ann.type)) {
          const primitiveName = ann.type.replace("TS", "").replace("Keyword", "").toLowerCase();
          context.report({
            node,
            messageId: "primitiveAlias",
            data: {
              name: node.id.name,
              primitive: primitiveName,
            },
          });
        }
      },
    };
  },
});
