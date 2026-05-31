import type { TSESLint } from "@typescript-eslint/utils";
import noAnyExternalData from "./rules/no-any-external-data.js";

const plugin: {
  rules: Record<string, TSESLint.RuleModule<string, unknown[]>>;
  configs: Record<string, unknown>;
} = {
  rules: {
    "no-any-external-data": noAnyExternalData,
  },
  configs: {},
};

export default plugin;
