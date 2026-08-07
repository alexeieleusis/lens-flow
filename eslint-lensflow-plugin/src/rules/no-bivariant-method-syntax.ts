import { createRule } from "../utils/rule-creator.js";
import { createBivariantMethodVisitor } from "../utils/bivariant-method-checker.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl(
  "catalog/T08-variance-subtyping.md",
  "Bivariant method vs. contravariant function property",
);

export default createRule({
  name: "no-bivariant-method-syntax",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow method-signature syntax in interfaces and type literals, which causes bivariant (unsound) parameter checking",
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
