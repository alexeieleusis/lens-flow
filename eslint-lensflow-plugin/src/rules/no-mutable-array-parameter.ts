import type { TSESLint } from "@typescript-eslint/utils";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import { createMutableArrayParamRule } from "../utils/visitor-helpers.js";

const URL = knowledgeUrl(
  "catalog/T08-variance-subtyping.md",
  "Example A — Read-only vs mutable container",
);

const rule: TSESLint.RuleModule<string, []> = createMutableArrayParamRule({
  name: "no-mutable-array-parameter",
  description:
    "Disallow mutable array types (`T[]` or `Array<T>`) in function parameters",
  messageId: "mutableArrayParam",
  messageTemplate:
    'Parameter "{{name}}" uses mutable array type "{{type}}". Use "readonly T[]" or "ReadonlyArray<T>" to prevent unsound covariant assignment. See: {{url}}',
  url: URL,
  reportData: (result) => ({
    name: result.paramName,
    type: result.typeText,
    url: URL,
  }),
});

export default rule;
