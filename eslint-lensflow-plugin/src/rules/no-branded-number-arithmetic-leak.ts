import ts from "typescript";
import { ESLintUtils, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

const URL =
  "https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T03-newtypes-opaque.md";

const ARITHMETIC_OPS = new Set(["+", "-", "*", "/", "%"]);

function hasBrandProperty(type: ts.Type): boolean {
  const props = type.getProperties();
  return props.some((p) => {
    const name = p.name as string;
    return name === "_brand" || name === "__brand" || /Brand$/.test(name);
  });
}

function hasNumberConstituent(checker: ts.TypeChecker, type: ts.Type): boolean {
  const constituents = (type as ts.IntersectionType)?.types;
  if (!constituents) return false;

  for (const c of constituents) {
    if ((c.flags & ts.TypeFlags.Number) !== 0) return true;
    if ((c.flags & ts.TypeFlags.NumberLiteral) !== 0) return true;
    const typeStr = checker.typeToString(c).trim().toLowerCase();
    if (typeStr === "number") return true;
  }
  return false;
}

function isBrandedNumber(checker: ts.TypeChecker, tsType: ts.Type): boolean {
  if ((tsType.flags & ts.TypeFlags.Intersection) !== 0) {
    if (hasNumberConstituent(checker, tsType) && hasBrandProperty(tsType)) {
      return true;
    }
    const constituents = (tsType as ts.IntersectionType).types;
    for (const c of constituents) {
      if (hasNumberConstituent(checker, tsType) && hasBrandProperty(c)) {
        return true;
      }
    }
  }

  const apparent = checker.getApparentType(tsType);
  if (apparent !== tsType && (apparent.flags & ts.TypeFlags.Intersection) !== 0) {
    if (hasNumberConstituent(checker, apparent) && hasBrandProperty(apparent)) {
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
