import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { getMemberName, hasAssertNever } from "../utils/ast-helpers.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("usecases/UC03-exhaustiveness.md");

function extractMemberFromBinary(
  node: TSESTree.BinaryExpression,
): string | null {
  const leftKey =
    node.left.type === "MemberExpression" ? getMemberName(node.left) : null;
  const rightKey =
    node.right.type === "MemberExpression" ? getMemberName(node.right) : null;
  return leftKey || rightKey || null;
}

function findAncestorIf(node: TSESTree.Node): TSESTree.IfStatement | null {
  let current: TSESTree.Node | null = node;
  while (current) {
    const parent = (current as unknown as Record<string, unknown>)[
      "parent"
    ] as TSESTree.Node | null;
    if (!parent) return null;
    if (
      parent.type === "FunctionDeclaration" ||
      parent.type === "FunctionExpression" ||
      parent.type === "ArrowFunctionExpression"
    )
      return null;
    if (parent.type === "IfStatement") return parent;
    current = parent;
  }
  return null;
}

export default createRule({
  name: "no-nested-assert-never-uc03",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow assertNever in default branch of switch nested inside a conditional that filters on the same discriminant",
    },
    messages: {
      nestedAssertNever:
        "assertNever in default branch of a switch nested inside a conditional that already filters on the same discriminant. The pre-filter makes the exhaustiveness check operate on an incomplete set of variants. Move the switch outside the conditional or handle the filtered variant separately. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"nestedAssertNever", []>) {
    return {
      SwitchStatement(node) {
        const defaultCase = node.cases.find((c) => c.test === null);
        if (!defaultCase) return;

        if (!defaultCase.consequent.some((s) => hasAssertNever(s))) return;

        const discriminant = node.discriminant;
        if (discriminant.type !== "MemberExpression") return;

        const switchKey = getMemberName(discriminant);
        if (!switchKey) return;

        const ancestorIf = findAncestorIf(node);
        if (!ancestorIf) return;

        const test = ancestorIf.test;

        if (
          test.type === "BinaryExpression" &&
          /^(==|===|!=|!==)$/.test(test.operator)
        ) {
          const ifMemberKey = extractMemberFromBinary(test);
          if (ifMemberKey === switchKey) {
            context.report({
              node,
              messageId: "nestedAssertNever",
              data: { url: URL },
            });
          }
        }
      },
    };
  },
});
