import { createRule } from "../utils/rule-creator.js";
import { createNoAnyParamChecker } from "../utils/no-any-param-checker.js";

export default createRule({
  name: "no-any-function-parameter",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow function parameters typed as `any`, which lose compile-time shape safety.",
    },
    messages: {
      anyParam:
        "Parameter '{{name}}' is typed as `any`. Use a structured interface or type instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T05-type-classes.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create: createNoAnyParamChecker("anyParam"),
});
