import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { hasAssertNever, hasThrow } from "../utils/ast-helpers.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T01-algebraic-data-types.md");

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

  if (nonEmpty.length === 1 && nonEmpty[0].type === "ContinueStatement")
    return true;

  if (
    nonEmpty.length === 1 &&
    nonEmpty[0].type === "BlockStatement" &&
    nonEmpty[0].body.length === 1 &&
    nonEmpty[0].body[0].type === "BreakStatement"
  )
    return true;

  if (
    nonEmpty.length === 1 &&
    nonEmpty[0].type === "BlockStatement" &&
    nonEmpty[0].body.length === 1 &&
    nonEmpty[0].body[0].type === "ContinueStatement"
  )
    return true;

  return false;
}

function hasNestedThrow(stmt: TSESTree.Statement): boolean {
  for (const child of (stmt as any).body || []) {
    if (hasThrow(child)) return true;
  }
  if (stmt.type === "IfStatement") {
    return (
      (stmt.consequent ? hasThrow(stmt.consequent) : false) ||
      (stmt.alternate ? hasThrow(stmt.alternate) : false)
    );
  }
  if (
    stmt.type === "ForStatement" ||
    stmt.type === "ForInStatement" ||
    stmt.type === "ForOfStatement" ||
    stmt.type === "WhileStatement" ||
    stmt.type === "DoWhileStatement"
  ) {
    return hasThrow((stmt as any).body);
  }
  return false;
}

function isSilentReturn(stmt: TSESTree.Statement): boolean {
  if (stmt.type === "ReturnStatement") {
    return !hasAssertNever(stmt) && !hasThrow(stmt);
  }
  if (stmt.type === "BlockStatement") {
    const hasNested = stmt.body.some(hasNestedThrow);
    if (hasNested) return false;
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
  name: "no-silent-default",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow silent default branches in switch statements with string-literal cases.",
    },
    messages: {
      silentDefault:
        "The default branch is silent (empty, break-only, or plain return). If this switch is meant to be exhaustive, add cases for all variants or call assertNever() in the default. See: {{url}}",
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
            data: { url: URL },
          });
        }
      },
    };
  },
});
