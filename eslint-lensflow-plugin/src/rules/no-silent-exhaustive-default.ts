import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { hasAssertNever, hasThrow } from "../utils/ast-helpers.js";

function isEmptyOrBreak(conseq: TSESTree.Statement[]): boolean {
  if (conseq.length === 0) return true;

  const nonEmpty = conseq.filter((s) => s.type !== "EmptyStatement");

  if (nonEmpty.length === 0) return true;

  if (
    nonEmpty.length === 1 &&
    nonEmpty[0].type === "BlockStatement" &&
    nonEmpty[0].body.length === 0
  )
    return true;

  if (
    nonEmpty.length === 1 &&
    nonEmpty[0].type === "BlockStatement" &&
    nonEmpty[0].body.every((s) => s.type === "EmptyStatement")
  )
    return true;

  if (nonEmpty.length === 1 && nonEmpty[0].type === "BreakStatement")
    return true;

  if (
    nonEmpty.length === 1 &&
    nonEmpty[0].type === "BlockStatement" &&
    nonEmpty[0].body.length === 1 &&
    nonEmpty[0].body[0].type === "BreakStatement"
  )
    return true;

  return false;
}

function isSilentReturn(stmt: TSESTree.Statement): boolean {
  if (stmt.type === "ReturnStatement") {
    return !hasAssertNever(stmt) && !hasThrow(stmt);
  }
  if (stmt.type === "BlockStatement") {
    return stmt.body.some(
      (inner) =>
        inner.type === "ReturnStatement" &&
        !hasAssertNever(inner) &&
        !hasThrow(inner),
    );
  }
  return false;
}

function isSilentDefault(conseq: TSESTree.Statement[]): boolean {
  if (isEmptyOrBreak(conseq)) return true;

  const nonEmpty = conseq.filter((s) => s.type !== "EmptyStatement");

  return nonEmpty.some(isSilentReturn);
}

function isDiscriminatedUnionSwitch(
  switchStmt: TSESTree.SwitchStatement,
): boolean {
  const { discriminant, cases } = switchStmt;

  if (discriminant.type !== "MemberExpression") return false;

  const hasStringCases = cases.some(
    (c) => c.test?.type === "Literal" && typeof c.test.value === "string",
  );

  return hasStringCases;
}

export default createRule({
  name: "no-silent-exhaustive-default",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow silent default branches in exhaustive switch statements that ignore unhandled variants.",
    },
    messages: {
      silentDefault:
        "The default branch silently ignores unhandled variants. Add a case for every variant or call assertNever() in the default. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T01-algebraic-data-types.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"silentDefault", []>) {
    return {
      SwitchStatement(node) {
        if (!isDiscriminatedUnionSwitch(node)) return;

        const defaultCase = node.cases.find((c) => c.test === null);
        if (!defaultCase) return;

        if (isSilentDefault(defaultCase.consequent)) {
          context.report({
            node: defaultCase,
            messageId: "silentDefault",
          });
        }
      },
    };
  },
});
