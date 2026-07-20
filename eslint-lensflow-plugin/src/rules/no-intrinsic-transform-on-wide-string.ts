import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

const URL = knowledgeUrl("catalog/T63-template-literal-types.md");

const INTRINSIC_TRANSFORMS = new Set([
  "Uppercase",
  "Lowercase",
  "Capitalize",
  "Uncapitalize",
]);

function isWideStringType(node: TSESTree.TypeNode): boolean {
  if (node.type === "TSStringKeyword") return true;
  if (node.type === "TSIntersectionType" || node.type === "TSUnionType")
    return node.types.every(isWideStringType);
  return false;
}

export default createRule({
  name: "no-intrinsic-transform-on-wide-string",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow applying intrinsic string transform types to the wide `string` type, which has no effect",
    },
    messages: {
      noEffect:
        "{{transform}} has no effect on the wide `string` type — it produces `string` unchanged. Use a string literal type or constrain the generic with `extends string`. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"noEffect", []>) {
    return {
      TSTypeReference(node) {
        const typeName = node.typeName;
        if (typeName.type !== "Identifier") return;

        if (!INTRINSIC_TRANSFORMS.has(typeName.name)) return;

        const params = node.typeArguments?.params;
        if (params?.length !== 1) return;

        if (!isWideStringType(params[0])) return;

        context.report({
          node,
          messageId: "noEffect",
          data: {
            transform: typeName.name,
            url: URL,
          },
        });
      },
    };
  },
});
