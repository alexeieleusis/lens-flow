import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "no-ts-ignore",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `@ts-ignore` in favor of `@ts-expect-error` which fails when the suppression is no longer needed",
    },
    messages: {
      preferExpectError:
        "Use `@ts-expect-error` instead of `@ts-ignore`. `@ts-expect-error` will warn if the suppressed line no longer has a type error, preventing silent dead suppressions. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T47-gradual-typing.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"preferExpectError", []>) {
    return {
      Program(node) {
        const comments = context.sourceCode.getAllComments();
        for (const comment of comments) {
          if (/^\s*@ts-ignore\b/.test(comment.value)) {
            context.report({
              node: comment as never,
              messageId: "preferExpectError",
            });
          }
        }
      },
    };
  },
});
