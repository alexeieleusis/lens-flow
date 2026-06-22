import ts from "typescript";
import { ESLintUtils, type TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { walkNodes } from "../utils/ast-helpers.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T14-type-narrowing.md");

function hasNeverCast(stmt: TSESTree.Statement): boolean {
  return walkNodes(
    stmt,
    (node) =>
      node.type === "TSAsExpression" &&
      node.typeAnnotation.type === "TSNeverKeyword",
  );
}

function hasExhaustivenessCheck(consequent: TSESTree.Statement[]): boolean {
  for (const stmt of consequent) {
    if (stmt.type === "EmptyStatement") continue;
    if (stmt.type === "ThrowStatement") return true;
    if (hasNeverCast(stmt)) return true;
  }
  return false;
}

function isBroadType(tsType: ts.Type): boolean {
  const flags = tsType.flags;
  return (
    (flags & ts.TypeFlags.String) !== 0 ||
    (flags & ts.TypeFlags.Number) !== 0 ||
    (flags & ts.TypeFlags.Boolean) !== 0
  );
}

function isLiteralType(tsType: ts.Type): boolean {
  return (
    (tsType.flags &
      (ts.TypeFlags.StringLiteral |
        ts.TypeFlags.NumberLiteral |
        ts.TypeFlags.BooleanLiteral)) !==
    0
  );
}

function isOpenUnion(tsType: ts.Type): boolean {
  if ((tsType.flags & ts.TypeFlags.Union) === 0) return false;

  const types = (tsType as ts.UnionType).types;
  let hasLiteral = false;
  let hasBroad = false;

  for (const member of types) {
    if (isLiteralType(member)) hasLiteral = true;
    if (isBroadType(member)) hasBroad = true;
  }

  return hasLiteral && hasBroad;
}

export default createRule({
  name: "no-exhaustiveness-on-open-union",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow exhaustiveness checks (throw / as never) in the default branch when the discriminant type is an open union that includes a broad base type like string",
     },
    messages: {
      openUnion:
        "This switch discriminant type is an open union (contains both literals and a broad type like string). The default branch will receive valid arbitrary values — do not use an exhaustiveness check (throw or as never) here. Use a fallback instead. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"openUnion", []>) {
    const parserServices = ESLintUtils.getParserServices(context);
    const program = parserServices.program;
    if (!program) return {};

    const checker = program.getTypeChecker();

    return {
      SwitchStatement(node) {
        const tsDiscriminant =
          parserServices.esTreeNodeToTSNodeMap.get(node.discriminant);
        if (!tsDiscriminant) return;

        const discriminantType = checker.getTypeAtLocation(tsDiscriminant);

        if (!isOpenUnion(discriminantType)) return;

        const defaultCase = node.cases.find((c) => c.test === null);
        if (!defaultCase) return;

        if (hasExhaustivenessCheck(defaultCase.consequent)) {
          context.report({
            node: defaultCase,
            messageId: "openUnion",
            data: { url: DOCS_URL },
          });
        }
      },
    };
  },
});
