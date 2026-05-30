import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";
import { createNoAnyParamTypeChecker } from "../utils/no-any-param-checker.js";

export default createRule({
  name: "no-any-callback-param",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow callback or function type parameters typed as `any`, which cause complete loss of input type information through the transformation.",
    },
    messages: {
      anyCallbackParam:
        "Callback parameter '{{name}}' is typed as `any`. Use a generic type parameter to preserve input type information. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T45-paramspec-variadic.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"anyCallbackParam", []>) {
    return createNoAnyParamTypeChecker("anyCallbackParam")(context);
  },
});
