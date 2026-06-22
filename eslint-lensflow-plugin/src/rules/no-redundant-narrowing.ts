import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

function testsEqual(
  context: Parameters<ReturnType<typeof createRule>["create"]>[0],
  a: unknown,
  b: unknown,
): boolean {
  if (
    a &&
    b &&
    typeof a === "object" &&
    typeof b === "object" &&
    (a as any).type === "BinaryExpression" &&
    (b as any).type === "BinaryExpression"
  ) {
    const leftA = (a as any).left;
    const leftB = (b as any).left;
    const rightA = (a as any).right;
    const rightB = (b as any).right;

    return (
      (a as any).operator === (b as any).operator &&
      leftA.type === leftB.type &&
      rightA.type === rightB.type &&
      context.sourceCode.getText(leftA) ===
        context.sourceCode.getText(leftB) &&
      context.sourceCode.getText(rightA) ===
        context.sourceCode.getText(rightB)
    );
  }
  return false;
}

export default createRule({
  name: "no-redundant-narrowing",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow redundant type narrowing checks that repeat an outer block's identical check",
    },
    messages: {
      redundantNarrowing:
        "This narrowing check is redundant because an outer block already performed the same check. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T14-type-narrowing.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"redundantNarrowing", []>) {
    return {
      IfStatement(node) {
        if (node.consequent.type !== "BlockStatement") return;

        for (const stmt of node.consequent.body) {
          if (stmt.type === "IfStatement" && testsEqual(context, node.test, stmt.test)) {
            context.report({
              node: stmt,
              messageId: "redundantNarrowing",
            });
          }
        }
      },
    };
  },
});
