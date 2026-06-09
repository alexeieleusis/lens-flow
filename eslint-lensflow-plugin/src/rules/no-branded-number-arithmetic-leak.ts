import ts from "typescript";
import { ESLintUtils, TSESLint, TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

const URL =
  "https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T03-newtypes-opaque.md";

const ARITHMETIC_OPS = new Set(["+", "-", "*", "/", "%"]);

function hasBrandProperty(type: ts.Type): boolean {
  const props = type.getProperties();
  return props.some((p) => {
    const name = p.escapedName as string;
    return /brand$/i.test(name);
  });
}

function isBrandedNumber(checker: ts.TypeChecker, tsType: ts.Type): boolean {
  const apparent = checker.getApparentType(tsType);
  if (hasBrandProperty(apparent)) return true;

  const constituents = (apparent as ts.IntersectionType)?.types;
  if (!constituents || constituents.length < 2) return false;

  for (const c of constituents) {
    if (hasBrandProperty(c)) return true;
  }
  return false;
}

export default createRule({
  name: "no-branded-number-arithmetic-leak",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow arithmetic operations on branded numbers that silently drop the brand.",
    },
    messages: {
      leak:
        "Arithmetic operation on branded number produces plain `number`, dropping the brand. Re-wrap the result with `as {{brandType}}` or use a dedicated function that preserves the brand. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"leak", []>) {
    const parserServices = ESLintUtils.getParserServices(context);
    const program = parserServices.program;
    if (!program) return {};

    const checker = program.getTypeChecker();
    const esTreeNodeToTSNodeMap = parserServices.esTreeNodeToTSNodeMap;

    function isBrandedNumberFromTypeNode(typeNode: ts.TypeNode): boolean {
      const tsType = checker.getTypeFromTypeNode(typeNode);
      return isBrandedNumber(checker, tsType);
    }

    function findBrandedTypeForIdentifier(
      ident: TSESTree.Identifier,
    ): ts.Type | null {
      const tsNode = esTreeNodeToTSNodeMap.get(ident);
      if (!tsNode) return null;

      const symbol = checker.getSymbolAtLocation(tsNode);
      if (!symbol) return null;

      for (const decl of symbol.declarations || []) {
        if (
          ts.isVariableDeclaration(decl) &&
          decl.type !== undefined
        ) {
          const annotatedType = checker.getTypeFromTypeNode(decl.type);
          if (isBrandedNumber(checker, annotatedType)) return annotatedType;
        }
      }

      return null;
    }

    return {
      BinaryExpression(node) {
        if (!ARITHMETIC_OPS.has(node.operator)) return;

        let leftBrandedType: ts.Type | null = null;
        let rightBrandedType: ts.Type | null = null;

        if (node.left.type === "Identifier") {
          leftBrandedType = findBrandedTypeForIdentifier(node.left);
        }
        if (!leftBrandedType) {
          const leftType = parserServices.getTypeAtLocation(node.left);
          if (isBrandedNumber(checker, leftType)) leftBrandedType = leftType;
        }

        if (node.right.type === "Identifier") {
          rightBrandedType = findBrandedTypeForIdentifier(node.right);
        }
        if (!rightBrandedType) {
          const rightType = parserServices.getTypeAtLocation(node.right);
          if (isBrandedNumber(checker, rightType)) rightBrandedType = rightType;
        }

        if (!leftBrandedType && !rightBrandedType) return;

        const parent = node.parent;
        if (parent?.type === "TSAsExpression") {
          const tsTypeAnnotation = esTreeNodeToTSNodeMap.get(
            parent.typeAnnotation,
          );
          if (tsTypeAnnotation && ts.isTypeNode(tsTypeAnnotation)) {
            if (isBrandedNumberFromTypeNode(tsTypeAnnotation)) return;
          }
        }

        const brandedType = leftBrandedType ?? rightBrandedType ?? undefined;
        const brandTypeName = checker.typeToString(brandedType!);

        context.report({
          node,
          messageId: "leak",
          data: {
            brandType: brandTypeName,
            url: URL,
          },
        });
      },
    };
  },
});
