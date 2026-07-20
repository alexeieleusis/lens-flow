import { createSwitchExhaustivenessRule } from "../utils/switch-exhaustiveness-rule.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const DOCS_URL = knowledgeUrl("catalog/T14-type-narrowing.md");

export default createSwitchExhaustivenessRule({
  name: "require-exhaustive-switch",
  description:
    "Require exhaustive switch statements on discriminated unions with a never-assertion or throw in the default branch",
  messageKey: "missingVariants",
  messageTemplate:
    "Switch statement is not exhaustive. Missing variants: {{missing}}. Handle all variants or add a default branch with assertNever or a throw statement. See: {{url}}",
  url: DOCS_URL,
});
