import type { TSESLint } from "@typescript-eslint/utils";
import consistentConstructorStrategy from "./rules/consistent-constructor-strategy.js";

const plugin: {
  rules: Record<string, TSESLint.RuleModule<string, unknown[]>>;
  configs: Record<string, unknown>;
} = {
  rules: {
    "consistent-constructor-strategy": consistentConstructorStrategy,
  },
  configs: {},
};

export default plugin;
