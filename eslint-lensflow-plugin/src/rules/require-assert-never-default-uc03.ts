import { TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { hasAssertNever } from "../utils/ast-helpers.js";

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
        "Default branch of a discriminant switch must call assertNever instead of returning a fallback value. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC03-exhaustiveness.md",
      emptyDefault:
        "Default branch of a discriminant switch is empty and must call assertNever. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC03-exhaustiveness.md",
      breakOnlyDefault:
        "Default branch of a discriminant switch only has a break statement and must call assertNever. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC03-exhaustiveness.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"emptyDefault" | "breakOnlyDefault" | "missingAssertNever", []>) {
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
          });
          return;
        }

        if (
          conseq.length === 1 &&
          conseq[0].type === "BreakStatement"
        ) {
          context.report({
            node: defaultCase,
            messageId: "breakOnlyDefault",
          });
          return;
        }

        if (!conseq.some((stmt) => hasAssertNever(stmt))) {
          context.report({
            node: defaultCase,
            messageId: "missingAssertNever",
          });
        }
      },
    };
  },
});
