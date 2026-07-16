import ts from "typescript";
import { ESLintUtils, type TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { walkNodes } from "../utils/ast-helpers.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const DOCS_URL = knowledgeUrl("catalog/T14-type-narrowing.md");

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
    if (walkNodes(stmt, (node) => node.type === "ThrowStatement")) return true;
    if (hasNeverCast(stmt)) return true;
  }
  return false;
}

function isBroadKeywordTypeNode(node: ts.TypeNode): boolean {
  return (
    node.kind === ts.SyntaxKind.StringKeyword ||
    node.kind === ts.SyntaxKind.NumberKeyword ||
    node.kind === ts.SyntaxKind.BooleanKeyword
  );
}

function isLiteralTypeNode(node: ts.TypeNode): boolean {
  if (!ts.isLiteralTypeNode(node)) return false;
  const lit = node.literal;
  return (
    ts.isStringLiteral(lit) ||
    ts.isNumericLiteral(lit) ||
    lit.kind === ts.SyntaxKind.TrueKeyword ||
    lit.kind === ts.SyntaxKind.FalseKeyword
  );
}

function isOpenUnionFromSyntax(typeNode: ts.TypeNode): boolean {
  if (!ts.isUnionTypeNode(typeNode)) return false;

  let hasLiteral = false;
  let hasBroad = false;

  for (const member of typeNode.types) {
    if (isLiteralTypeNode(member)) hasLiteral = true;
    if (isBroadKeywordTypeNode(member)) hasBroad = true;
  }

  return hasLiteral && hasBroad;
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

    function isDiscriminantOpenUnion(tsNode: ts.Node): boolean {
      const symbol = checker.getSymbolAtLocation(tsNode);
      if (symbol) {
        const declarations = symbol.getDeclarations();
        if (declarations) {
          for (const decl of declarations) {
            let typeNode: ts.TypeNode | undefined;
            if (
              ts.isParameter(decl) ||
              ts.isVariableDeclaration(decl) ||
              ts.isPropertyDeclaration(decl) ||
              ts.isPropertySignature(decl)
            ) {
              typeNode = decl.type;
            }

            if (typeNode && isOpenUnionFromSyntax(typeNode)) return true;
          }
        }
      }

      return isOpenUnion(checker.getTypeAtLocation(tsNode));
    }

    return {
      SwitchStatement(node) {
        const tsDiscriminant =
          parserServices.esTreeNodeToTSNodeMap.get(node.discriminant);
        if (!tsDiscriminant) return;

        if (!isDiscriminantOpenUnion(tsDiscriminant)) return;

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
