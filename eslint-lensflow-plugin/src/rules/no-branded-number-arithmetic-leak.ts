import ts from "typescript";
import { ESLintUtils, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

const URL =
  "https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T03-newtypes-opaque.md";

const ARITHMETIC_OPS = new Set(["+", "-", "*", "/", "%"]);

function hasBrandProperty(type: ts.Type): boolean {
  const props = type.getProperties();
  return props.some((p) => {
    const name = p.escapedName as string;
    return /_+brand/i.test(name) || /Brand$/.test(name);
  });
}

function isIntersectionWithBrandAndNumber(
  checker: ts.TypeChecker,
  intersection: ts.IntersectionType,
): boolean {
  const constituents = intersection.types;
  if (!constituents || constituents.length < 2) return false;

  let hasNumber = false;
  let hasBrand = false;

  for (const constituent of constituents) {
    const typeStr = checker.typeToString(constituent).trim().toLowerCase();
    if (
      (constituent.flags &
        (ts.TypeFlags.Number |
          ts.TypeFlags.NumberLiteral |
          ts.TypeFlags.BigInt |
          ts.TypeFlags.BigIntLiteral)) !==
      0
    ) {
      hasNumber = true;
    } else if (typeStr === "number") {
      hasNumber = true;
    }

    if ((constituent.flags & ts.TypeFlags.Object) !== 0) {
      if (hasBrandProperty(constituent)) {
        hasBrand = true;
      }
    }
  }

  return hasNumber && hasBrand;
}

function isIntersectionType(t: ts.Type): t is ts.IntersectionType {
  return (t as ts.IntersectionType).types !== undefined;
}

function isBrandedNumber(checker: ts.TypeChecker, tsType: ts.Type): boolean {
  // Check the original type directly (it may already be an intersection)
  if (isIntersectionType(tsType)) {
    if (isIntersectionWithBrandAndNumber(checker, tsType)) return true;
  }

  // Check the apparent type
  const apparent = checker.getApparentType(tsType);
  if (apparent !== tsType && isIntersectionType(apparent)) {
    if (isIntersectionWithBrandAndNumber(checker, apparent)) return true;
  }

  // Check via symbol declarations (type alias defined as intersection)
  const sym = tsType.symbol || tsType.aliasSymbol;
  if (sym) {
    for (const decl of sym.declarations ?? []) {
      if (
        ts.isTypeAliasDeclaration(decl) &&
        ts.isIntersectionTypeNode(decl.type)
      ) {
        let hasNumber = false;
        let hasBrand = false;
        for (const typeNode of decl.type.types) {
          const checkedType = checker.getTypeFromTypeNode(typeNode);
          const typeStr = checker
            .typeToString(checkedType)
            .trim()
            .toLowerCase();
          if (
            (checkedType.flags & ts.TypeFlags.Number) !== 0 ||
            typeStr === "number"
          ) {
            hasNumber = true;
          }
          if (
            (checkedType.flags & ts.TypeFlags.Object) !== 0 &&
            hasBrandProperty(checkedType)
          ) {
            hasBrand = true;
          }
        }
        if (hasNumber && hasBrand) return true;
      }
    }
  }

  // Fallback: check if type is number-like and has brand properties
  const typeStr = checker.typeToString(tsType).trim().toLowerCase();
  const isNumberLike =
    (tsType.flags & ts.TypeFlags.Number) !== 0 || typeStr === "number";

  if (isNumberLike || typeStr.includes("&")) {
    if (hasBrandProperty(tsType) || hasBrandProperty(apparent)) {
      return true;
    }
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

    return {
      BinaryExpression(node) {
        if (!ARITHMETIC_OPS.has(node.operator)) return;

        const leftType = parserServices.getTypeAtLocation(node.left);
        const rightType = parserServices.getTypeAtLocation(node.right);

        const leftBranded = isBrandedNumber(checker, leftType);
        const rightBranded = isBrandedNumber(checker, rightType);

        if (!leftBranded && !rightBranded) return;

        const parent = node.parent;
        if (parent?.type === "TSAsExpression" || parent?.type === "TSTypeAssertion") {
          const castResultType = parserServices.getTypeAtLocation(parent);
          if (isBrandedNumber(checker, castResultType)) return;
        }

        const brandedType = leftBranded ? leftType : rightType;
        const brandTypeName = checker.typeToString(brandedType);

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
