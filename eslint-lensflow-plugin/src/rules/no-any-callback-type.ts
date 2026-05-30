import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "no-any-callback-type",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `(...args: any[]) => any` callback types that lose all parameter and return type information",
    },
    messages: {
      anyCallbackType:
        "Avoid `(...args: any[]) => any` callback types — they lose all parameter and return type information. Use an explicit callable type with typed parameters instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T22-callable-typing.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"anyCallbackType", []>) {
    return {
      TSFunctionType(node) {
        if (node.params.length !== 1) return;

        const param = node.params[0];
        if (param.type !== "RestElement") return;

        const typeAnn = param.typeAnnotation?.typeAnnotation;
        if (typeAnn?.type !== "TSArrayType") return;

        if (typeAnn.elementType.type !== "TSAnyKeyword") return;

        if (node.returnType?.typeAnnotation.type !== "TSAnyKeyword") return;

        context.report({
          node,
          messageId: "anyCallbackType",
        });
      },
    };
  },
});
