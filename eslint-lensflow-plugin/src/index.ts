import type { TSESLint } from "@typescript-eslint/utils";

const plugin: {
  rules: Record<string, TSESLint.RuleModule<string, unknown[]>>;
  configs: Record<string, unknown>;
} = {
  rules: {},
  configs: {},
};

export default plugin;
