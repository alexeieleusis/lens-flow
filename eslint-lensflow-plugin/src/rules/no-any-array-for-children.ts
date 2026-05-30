import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "no-any-array-for-children",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `any[]` on children/nested elements properties — use a self-referential type instead.",
    },
    messages: {
      anyArrayChildren:
        "Property \"{{propName}}\" uses `any[]` for a nested structure. Use a self-referential type (e.g. `{{parentName}}[]`) for structural type safety. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T61-recursive-types.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"anyArrayChildren", []>) {
    const nestedPattern = /^(children|nodes|items|elements|subs?ubs?)/i;

    return {
      TSPropertySignature(node) {
        if (node.key.type !== "Identifier") return;

        const propName = node.key.name;
        if (!nestedPattern.test(propName)) return;

        const typeAnn = node.typeAnnotation?.typeAnnotation;
        if (typeAnn?.type !== "TSArrayType") return;
        if (typeAnn.elementType.type !== "TSAnyKeyword") return;

        const parent = node.parent;
        const parentName =
          parent.type === "TSTypeLiteral" || parent.type === "TSInterfaceBody"
            ? (context.sourceCode.getText(parent).split(/[{}:]/)[0] || "the containing type")
            : "the containing type";

        context.report({
          node,
          messageId: "anyArrayChildren",
          data: { propName, parentName },
        });
      },
    };
  },
});
