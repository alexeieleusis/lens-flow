import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";
import { createNoAnyParamChecker, createNoAnyParamTypeChecker } from "../utils/no-any-param-checker.js";

export default createRule({
  name: "no-any-parameter",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `any` as a parameter type in function declarations, expressions, function types, and method signatures.",
    },
    messages: {
      anyParam:
        "Parameter '{{name}}' is typed as `any`. Use a specific type (string, number, etc.) instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T47-gradual-typing.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"anyParam", []>) {
    return {
      ...createNoAnyParamChecker("anyParam")(context),
      ...createNoAnyParamTypeChecker("anyParam")(context),
    };
  },
});
