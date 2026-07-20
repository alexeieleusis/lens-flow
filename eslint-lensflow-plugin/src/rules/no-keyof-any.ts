import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

const URL = knowledgeUrl("catalog/T04-generics-bounds.md");

function containsAnyType(node: TSESTree.TypeNode): boolean {
  if (node.type === "TSAnyKeyword") return true;
  if (node.type === "TSUnionType" || node.type === "TSIntersectionType") {
    return node.types.some(containsAnyType);
  }
  // TSParenthesizedType can appear at runtime but isn't in @typescript-eslint types
  const maybe = node as unknown as { type: string; typeAnnotation?: TSESTree.TypeNode };
  if (maybe.type === "TSParenthesizedType" && maybe.typeAnnotation) {
    return containsAnyType(maybe.typeAnnotation);
  }
  return false;
}

export default createRule({
  name: "no-keyof-any",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `keyof any` which resolves to `string | number | symbol` and defeats key-based constraints",
    },
    messages: {
     keyofAny:
        "`keyof any` resolves to `string | number | symbol`, defeating key-based constraints. Use `keyof T` to constrain to the type's keys instead. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"keyofAny", []>) {
    return {
      TSTypeOperator(node) {
        if (node.operator === "keyof" && node.typeAnnotation && containsAnyType(node.typeAnnotation)) {
          context.report({ node, messageId: "keyofAny", data: { url: URL } });
        }
      },
    };
  },
});
