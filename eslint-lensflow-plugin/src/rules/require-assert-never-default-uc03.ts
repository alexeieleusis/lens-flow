import { TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { hasAssertNever } from "../utils/ast-helpers.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("usecases/UC03-exhaustiveness.md");

export default createRule({
  name: "require-assert-never-default-uc03",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require assertNever call in default branch of discriminant switch statements",
    },
    messages: {
      missingAssertNever:
        "Default branch of a discriminant switch must call assertNever instead of returning a fallback value. See: {{url}}",
      emptyDefault:
        "Default branch of a discriminant switch is empty and must call assertNever. See: {{url}}",
      breakOnlyDefault:
        "Default branch of a discriminant switch only has a break statement and must call assertNever. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(
    context: TSESLint.RuleContext<
      "emptyDefault" | "breakOnlyDefault" | "missingAssertNever",
      []
    >,
  ) {
    return {
      SwitchStatement(node) {
        const discriminant = node.discriminant;
        if (discriminant.type !== "MemberExpression") return;

        const cases = node.cases;
        const stringLiteralCases = cases.filter(
          (c) => c.test?.type === "Literal" && typeof c.test.value === "string",
        );
        if (stringLiteralCases.length < 2) return;

        const defaultCase = cases.find((c) => c.test === null);
        if (!defaultCase) return;

        const conseq = defaultCase.consequent;

        if (conseq.length === 0) {
          context.report({
            node: defaultCase,
            messageId: "emptyDefault",
            data: { url: URL },
          });
          return;
        }

        if (conseq.length === 1 && conseq[0].type === "BreakStatement") {
          context.report({
            node: defaultCase,
            messageId: "breakOnlyDefault",
            data: { url: URL },
          });
          return;
        }

        if (!conseq.some((stmt) => hasAssertNever(stmt))) {
          context.report({
            node: defaultCase,
            messageId: "missingAssertNever",
            data: { url: URL },
          });
        }
      },
    };
  },
});
