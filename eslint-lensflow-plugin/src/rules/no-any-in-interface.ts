import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

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
        "Property \"{{name}}\" uses `any` type, defeating structural typing. Replace with a specific type. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T05-type-classes.md",
      anyIndexSignature:
        "Index signature returns `any` type. Replace with a specific return type. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T05-type-classes.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"anyProperty" | "anyIndexSignature", []>) {
    return {
      TSPropertySignature(node) {
        if (node.typeAnnotation?.typeAnnotation.type === "TSAnyKeyword") {
          let name: string;
          if (node.key.type === "Identifier") {
            name = node.key.name;
          } else if (node.key.type === "Literal") {
            name = String(node.key.value);
          } else {
            name = "[unknown]";
          }
          context.report({
            node,
            messageId: "anyProperty",
            data: { name },
          });
        }
      },
      TSIndexSignature(node) {
        if (node.typeAnnotation?.typeAnnotation.type === "TSAnyKeyword") {
          context.report({
            node,
            messageId: "anyIndexSignature",
          });
        }
      },
    };
  },
});
