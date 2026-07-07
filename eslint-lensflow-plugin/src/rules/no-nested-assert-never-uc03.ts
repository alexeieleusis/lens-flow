import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { getMemberName } from "../utils/ast-helpers.js";

function isAssertNeverCall(node: TSESTree.Node): boolean {
  if (node.type !== "CallExpression") return false;
  const callee = node.callee;
  if (callee.type !== "Identifier") return false;
  return /^assertNever$/.test(callee.name);
}

const SKIP_KEYS = new Set(["parent", "loc", "range", "type", "name"]);

function isNodeLike(val: unknown): val is { type: string } {
  return val != null && typeof val === "object" && "type" in val;
}

function containsAssertNever(node: TSESTree.Node): boolean {
  if (isAssertNeverCall(node)) return true;

  const obj = node as unknown as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (SKIP_KEYS.has(key)) continue;
    if (checkValueForAssertNever(obj[key])) return true;
  }
  return false;
}

function checkValueForAssertNever(val: unknown): boolean {
  if (Array.isArray(val)) {
    for (const child of val) {
      if (isNodeLike(child) && containsAssertNever(child as TSESTree.Node)) return true;
    }
  } else if (isNodeLike(val)) {
    if (containsAssertNever(val as TSESTree.Node)) return true;
  }
  return false;
}

function extractMemberFromBinary(node: TSESTree.BinaryExpression): string | null {
  const leftKey =
    node.left.type === "MemberExpression" ? getMemberName(node.left) : null;
  const rightKey =
    node.right.type === "MemberExpression" ? getMemberName(node.right) : null;
  return leftKey || rightKey || null;
}

function findAncestorIf(node: TSESTree.Node): TSESTree.IfStatement | null {
  let current: TSESTree.Node | null = node;
  while (current) {
    const parent = (current as unknown as Record<string, unknown>)["parent"] as TSESTree.Node | null;
    if (!parent) return null;
    if (
      parent.type === "FunctionDeclaration" ||
      parent.type === "FunctionExpression" ||
      parent.type === "ArrowFunctionExpression"
    ) return null;
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
        "assertNever in default branch of a switch nested inside a conditional that already filters on the same discriminant. The pre-filter makes the exhaustiveness check operate on an incomplete set of variants. Move the switch outside the conditional or handle the filtered variant separately. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC03-exhaustiveness.md",
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

        if (!containsAssertNever(defaultCase)) return;

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
            });
          }
        }
      },
    };
  },
});
