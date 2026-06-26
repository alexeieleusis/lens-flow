import { ESLintUtils } from "@typescript-eslint/utils";

export const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/alexeieleusis/lens-flow/tree/main/eslint-lensflow-plugin/docs/rules/${name}`,
);
