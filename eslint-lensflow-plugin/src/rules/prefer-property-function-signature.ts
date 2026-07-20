import { createRule } from "../utils/rule-creator.js";
import { createBivariantMethodVisitor } from "../utils/bivariant-method-checker.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T08-variance-subtyping.md");

export default createRule({
  name: "prefer-property-function-signature",
  meta: {
    type: "suggestion",
    deprecated: true,
    replacedBy: ["no-bivariant-method-syntax"],
    docs: {
      description:
        "[DEPRECATED] Use no-bivariant-method-syntax instead. Prefer property function syntax (`foo: () => void`) over method syntax (`foo(): void`) in interfaces to ensure proper contravariance under --strictFunctionTypes",
    },
    messages: {
      methodSyntax:
        "Method signature '{{name}}' uses bivariant syntax. Use function-property syntax (e.g. '{{name}}: ({{params}}) => ReturnType') for contravariant parameter checking. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context) {
    return createBivariantMethodVisitor(context, { url: URL });
  },
});
