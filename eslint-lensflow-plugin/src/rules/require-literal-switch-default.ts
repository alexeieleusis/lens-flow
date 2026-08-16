import type { TSESLint } from "@typescript-eslint/utils";
import { createSwitchExhaustivenessRule } from "../utils/switch-exhaustiveness-rule.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const DOC_URL = knowledgeUrl(
  "catalog/T52-literal-types.md",
  "C. Unexhaustive `switch`",
);

const rule: TSESLint.RuleModule<string, []> = createSwitchExhaustivenessRule({
  name: "require-literal-switch-default",
  description:
    "Require a default case with assertNever exhaustiveness guard on switch statements over literal union types",
  messageKey: "missingDefaultExhaustiveness",
  messageTemplate:
    "Switch on literal union type is missing a default case with assertNever exhaustiveness guard. Missing variants: {{missing}}. See: {{url}}",
  url: DOC_URL,
});

export default rule;
