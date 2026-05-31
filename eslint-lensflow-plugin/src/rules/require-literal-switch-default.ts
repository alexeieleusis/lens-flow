import { createSwitchExhaustivenessRule } from "../utils/switch-exhaustiveness-rule.js";

const URL =
  "https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T52-literal-types.md";

export default createSwitchExhaustivenessRule({
  name: "require-literal-switch-default",
  description:
    "Require a default case with assertNever exhaustiveness guard on switch statements over literal union types",
  messageKey: "missingDefaultExhaustiveness",
  messageTemplate:
    "Switch on literal union type is missing a default case with assertNever exhaustiveness guard. Missing variants: {{missing}}. See: {{url}}",
  url: URL,
});
