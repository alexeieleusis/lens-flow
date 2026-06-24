import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

const INTRINSIC_TRANSFORMS = new Set([
  "Uppercase",
  "Lowercase",
  "Capitalize",
  "Uncapitalize",
]);

export default createRule({
  name: "no-intrinsic-transform-on-wide-string",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow applying intrinsic string transform types to the wide `string` type, which has no effect",
      url: "https://github.com/jpablo/vibe-types/blob/main/plugin/skills/typescript/catalog/T63-template-literal-types.md",
    },
    messages: {
      noEffect:
        "{{transform}} has no effect on the wide `string` type — it produces `string` unchanged. Use a string literal type or constrain the generic with `extends string`. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T63-template-literal-types.md",
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

        let typeParam = params[0];
        if (typeParam.type !== "TSStringKeyword") return;

        context.report({
          node,
          messageId: "noEffect",
          data: {
            transform: typeName.name,
          },
        });
      },
    };
  },
});
