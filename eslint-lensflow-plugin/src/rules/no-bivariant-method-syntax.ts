import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";
import { createBivariantMethodVisitor } from "../utils/bivariant-method-checker.js";

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
        "Method signature '{{name}}' uses bivariant syntax. Use function-property syntax (e.g. '{{name}}: ({{params}}) => ReturnType') for contravariant parameter checking. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T08-variance-subtyping.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"methodSyntax", []>) {
    return createBivariantMethodVisitor(context);
  },
});
