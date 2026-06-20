import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";
import { containsAny, containsUnknown } from "../utils/ts-helpers.js";

export default createRule({
  name: "no-broad-index-signatures",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow broad `any` or `unknown` index signatures that eliminate structural type safety.",
    },
    messages: {
      broadIndexSignature:
        "Index signature uses `{{type}}` which eliminates structural type safety. Use explicit properties or a narrower index type instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T07-structural-typing.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"broadIndexSignature", []>) {
    return {
      TSIndexSignature(node) {
        const typeAnnotation = node.typeAnnotation?.typeAnnotation;
        if (!typeAnnotation) return;
        if (containsAny(typeAnnotation)) {
          context.report({
            node,
            messageId: "broadIndexSignature",
            data: { type: "any" },
          });
        } else if (containsUnknown(typeAnnotation)) {
          context.report({
            node,
            messageId: "broadIndexSignature",
            data: { type: "unknown" },
          });
        }
      },
    };
  },
});
