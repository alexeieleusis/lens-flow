import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";
import { createNoAnyParamTypeChecker } from "../utils/no-any-param-checker.js";

export default createRule({
  name: "no-any-callback-parameter",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `any` in callback function parameter types, which allows callers to pass callbacks that operate unsafely on values of any shape.",
    },
    messages: {
      anyCallbackParameter:
        "Callback parameter '{{name}}' is typed as `any`. Use a generic type parameter or `unknown` to safely constrain the callback's input type. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T47-gradual-typing.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"anyCallbackParameter", []>) {
    return createNoAnyParamTypeChecker("anyCallbackParameter")(context);
  },
});
