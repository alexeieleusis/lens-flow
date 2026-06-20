import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";
import { containsAny } from "../utils/ts-helpers.js";

const KNOWLEDGE_URL =
  "https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T05-type-classes.md";

export default createRule({
  name: "no-any-in-interface",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `any` as a property type inside an interface or type literal",
    },
    messages: {
      anyProperty:
        "Property \"{{name}}\" uses `any` type, defeating structural typing. Replace with a specific type. See: {{url}}",
      anyIndexSignature:
        "Index signature returns `any` type. Replace with a specific return type. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"anyProperty" | "anyIndexSignature", []>) {
    return {
      TSPropertySignature(node) {
        const typeAnnotation = node.typeAnnotation?.typeAnnotation;
        if (typeAnnotation && containsAny(typeAnnotation)) {
          let name: string;
          if (node.key.type === "Identifier") {
            name = node.key.name;
          } else if (node.key.type === "Literal") {
            name = String(node.key.value);
          } else {
            name = context.sourceCode.getText(node.key);
          }
          context.report({
            node,
            messageId: "anyProperty",
            data: { name, url: KNOWLEDGE_URL },
          });
        }
      },
      TSIndexSignature(node) {
        const typeAnnotation = node.typeAnnotation?.typeAnnotation;
        if (typeAnnotation && containsAny(typeAnnotation)) {
          context.report({
            node,
            messageId: "anyIndexSignature",
            data: { url: KNOWLEDGE_URL },
          });
        }
      },
    };
  },
});
