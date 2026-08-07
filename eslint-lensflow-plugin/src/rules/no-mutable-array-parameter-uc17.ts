import { knowledgeUrl } from "../utils/knowledge-url.js";
import { createMutableArrayParamRule } from "../utils/visitor-helpers.js";

const URL = knowledgeUrl(
  "usecases/UC17-variance.md",
  "Antipatterns with Other Techniques > Using mutable arrays instead of `readonly` + covariance",
);

export default createMutableArrayParamRule({
  name: "no-mutable-array-parameter-uc17",
  description:
    "Disallow mutable array types in function parameters — use `readonly T[]` or `ReadonlyArray<T>` to prevent unsound covariant mutation.",
  messageId: "mutableArrayParam",
  messageTemplate:
    'Parameter "{{name}}" uses mutable array type "{{type}}". Use `readonly {{elem}}[]` or `ReadonlyArray<{{elem}}>`. See: {{url}}',
  url: URL,
  reportData: (result) => ({
    name: result.paramName,
    type: result.typeText,
    elem: result.elemText,
    url: URL,
  }),
});
