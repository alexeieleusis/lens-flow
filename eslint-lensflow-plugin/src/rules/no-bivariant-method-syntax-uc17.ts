import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";
import { createBivariantMethodVisitor } from "../utils/bivariant-method-checker.js";

export default createRule({
  name: "no-bivariant-method-syntax-uc17",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow method-signature syntax in interfaces and type literals which causes bivariant parameter checking that bypasses --strictFunctionTypes",
    },
    messages: {
      methodSyntax:
        "Method signature '{{name}}' uses bivariant syntax. Use function-property syntax (e.g. '{{name}}: ({{params}}) => {{returnType}}') for contravariant parameter checking. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/usecases/UC17-variance.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"methodSyntax", []>) {
    return createBivariantMethodVisitor(context);
  },
});
