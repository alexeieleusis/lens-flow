import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESLint } from "@typescript-eslint/utils";

const URL = knowledgeUrl("catalog/T23-type-aliases.md");

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
        'Type alias "{{name}}" is a transparent alias for "{{primitive}}". Use the primitive directly or a branded type for nominal distinction. See: {{url}}',
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"primitiveAlias", []>) {
    return {
      TSTypeAliasDeclaration(node) {
        const unwrapped = node.typeAnnotation;
        if (primitiveTypes.has(unwrapped.type)) {
          const primitiveName = unwrapped.type
            .replace("TS", "")
            .replace("Keyword", "")
            .toLowerCase();
          context.report({
            node,
            messageId: "primitiveAlias",
            data: {
              name: node.id.name,
              primitive: primitiveName,
              url: URL,
            },
          });
        }
      },
    };
  },
});
