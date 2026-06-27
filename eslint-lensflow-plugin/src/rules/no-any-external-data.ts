import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";
import { createNoAnyParamChecker, createNoAnyParamTypeChecker } from "../utils/no-any-param-checker.js";

export default createRule({
  name: "no-any-external-data",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `any` as a function parameter type, which bypasses all type checking and prevents narrowing.",
    },
    messages: {
      anyExternalParam:
        "Parameter '{{name}}' is typed as `any`, which short-circuits type checking and prevents narrowing. Use a union type like `string | number | boolean` instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T14-type-narrowing.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"anyExternalParam", []>) {
    return {
      ...createNoAnyParamChecker("anyExternalParam")(context),
      ...createNoAnyParamTypeChecker("anyExternalParam")(context),
    };
  },
});
