import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

const SKIPPED_KEYS = new Set(["parent", "loc", "range", "type", "name"]);

function isChildNode(val: unknown): val is TSESTree.Node {
  return val != null && typeof val === "object" && "type" in val;
}

function checkValue(val: unknown): boolean {
  if (Array.isArray(val)) {
    for (const child of val) {
      if (isChildNode(child) && containsCallExpression(child)) return true;
    }
    return false;
  }

  return isChildNode(val) && containsCallExpression(val);
}

function containsCallExpression(node: TSESTree.Node): boolean {
  if (node.type === "CallExpression") return true;

  const obj = node as unknown as Record<string, unknown>;

  for (const key of Object.keys(obj)) {
    if (SKIPPED_KEYS.has(key)) continue;
    const val = obj[key];
    if (val == null) continue;
    if (checkValue(val)) return true;
  }
  return false;
}

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

        if (!containsCallExpression(defaultCase)) {
          context.report({
            node: defaultCase,
            messageId: "missingAssertNever",
          });
        }
      },
    };
  },
});
