import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

function containsAny(typeNode: TSESTree.TypeNode): boolean {
  if (typeNode.type === "TSAnyKeyword") return true;
  if (typeNode.type === "TSUnionType") {
    return typeNode.types.some((member) => member.type === "TSAnyKeyword");
  }
  return false;
}

export default createRule({
  name: "no-any-index-signature",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow index signatures that use `any` as the value type, which loses all type safety for dynamically keyed properties.",
    },
    messages: {
      anyIndexSignature:
        "Index signature uses `any` as the value type, losing all type safety for dynamically keyed properties. Use a specific union type instead (e.g., `string | number | boolean`). See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T31-record-types.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"anyIndexSignature", []>) {
    return {
      TSIndexSignature(node) {
        const typeAnnotation = node.typeAnnotation?.typeAnnotation;
        if (typeAnnotation && containsAny(typeAnnotation)) {
          context.report({
            node,
            messageId: "anyIndexSignature",
          });
        }
      },
    };
  },
});
