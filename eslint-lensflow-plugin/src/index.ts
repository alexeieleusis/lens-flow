import type { TSESLint } from "@typescript-eslint/utils";
import noAnyExternalData from "./rules/no-any-external-data.js";
import noAnyInDiscriminantCheckUC03 from "./rules/no-any-in-discriminant-check-uc03.js";
import noAnyInPluginContextUC14 from "./rules/no-any-in-plugin-context-uc14.js";

const plugin: {
  rules: Record<string, TSESLint.RuleModule<string, unknown[]>>;
  configs: Record<string, unknown>;
} = {
  rules: {
    "no-any-external-data": noAnyExternalData,
    "no-any-in-discriminant-check-uc03": noAnyInDiscriminantCheckUC03,
    "no-any-in-plugin-context-uc14": noAnyInPluginContextUC14,
  },
  configs: {},
};

export default plugin;
