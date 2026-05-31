import { createSwitchExhaustivenessRule } from "../utils/switch-exhaustiveness-rule.js";

const URL =
  "https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T14-type-narrowing.md";

export default createSwitchExhaustivenessRule({
  name: "require-exhaustive-switch",
  description:
    "Require exhaustive switch statements on discriminated unions with a never-assertion in the default branch",
  messageKey: "missingVariants",
  messageTemplate:
    "Switch statement is not exhaustive. Missing variants: {{missing}}. Handle all variants or add a default branch with assertNever. See: {{url}}",
  url: URL,
});
