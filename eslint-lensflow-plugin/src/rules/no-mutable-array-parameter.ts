import type { TSESLint } from "@typescript-eslint/utils";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import { createMutableArrayParamRule } from "../utils/visitor-helpers.js";

const URL = knowledgeUrl(
  "usecases/UC17-variance.md",
  "Antipatterns with Other Techniques > Using mutable arrays instead of `readonly` + covariance",
);

// Element types that are not a plain (generic) reference need parentheses
// before a `[]` suffix, e.g. `readonly (string | number)[]`.
const SIMPLE_ELEM = /^[\w$.]+(<[^]*>)?(\[\])*$/;

const rule: TSESLint.RuleModule<string, []> = createMutableArrayParamRule({
  name: "no-mutable-array-parameter",
  description:
    "Disallow mutable array types in function parameters — use `readonly T[]` or `ReadonlyArray<T>` to prevent unsound covariant mutation.",
  messageId: "mutableArrayParam",
  messageTemplate:
    'Parameter "{{name}}" uses mutable array type "{{type}}". Use `readonly {{elemGrouped}}[]` or `ReadonlyArray<{{elem}}>`. See: {{url}}',
  url: URL,
  reportData: (result) => ({
    name: result.paramName,
    type: result.typeText,
    elem: result.elemText,
    elemGrouped: SIMPLE_ELEM.test(result.elemText)
      ? result.elemText
      : `(${result.elemText})`,
    url: URL,
  }),
});

export default rule;
