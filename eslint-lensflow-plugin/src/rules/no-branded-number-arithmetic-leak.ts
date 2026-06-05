import ts from "typescript";
import { ESLintUtils, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

const URL =
  "https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T03-newtypes-opaque.md";

const ARITHMETIC_OPS = new Set(["+", "-", "*", "/", "%"]);

function isBrandedNumber(checker: ts.TypeChecker, tsType: ts.Type): boolean {
  // Check getProperties() directly on the type (works for intersections)
  const props = tsType.getProperties();
  const hasBrand = props.some((p) => {
    const name = p.escapedName as string;
    // TypeScript escapes names starting with _ by prepending another _,
    // so __brand appears as ___brand, _brand appears as __brand
    return (
      name.includes("brand") &&
      (name.startsWith("_") || name.endsWith("Brand"))
    );
  });

  if (!hasBrand) return false;

  // Type is branded. Now check if it's number-based.
  // Check the type string for "number"
  const typeStr = checker.typeToString(tsType).toLowerCase();
  if (typeStr.includes("number")) return true;

  // Check raw constituents for number flag
  const rawConstituents = (tsType as ts.IntersectionType)?.types;
  if (rawConstituents) {
    for (const c of rawConstituents) {
      if ((c.flags & ts.TypeFlags.Number) !== 0) return true;
      const cStr = checker.typeToString(c).trim().toLowerCase();
      if (cStr === "number") return true;
    }
  }

  // Check apparent type constituents
  const apparent = checker.getApparentType(tsType);
  const apparentConstituents = (apparent as ts.IntersectionType)?.types;
  if (apparentConstituents) {
    for (const c of apparentConstituents) {
      if ((c.flags & ts.TypeFlags.Number) !== 0) return true;
      const cStr = checker.typeToString(c).trim().toLowerCase();
      if (cStr === "number") return true;
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

        const leftTS = parserServices.esTreeNodeToTSNodeMap.get(node.left);
        const rightTS = parserServices.esTreeNodeToTSNodeMap.get(node.right);

        const leftType = checker.getTypeAtLocation(leftTS as ts.Expression);
        const rightType = checker.getTypeAtLocation(rightTS as ts.Expression);

        const leftBranded = isBrandedNumber(checker, leftType);
        const rightBranded = isBrandedNumber(checker, rightType);

        if (!leftBranded && !rightBranded) return;

        const parent = node.parent;
        if (parent?.type === "TSAsExpression" || parent?.type === "TSTypeAssertion") {
          const parentTS = parserServices.esTreeNodeToTSNodeMap.get(parent);
          const castResultType = checker.getTypeAtLocation(
            parentTS as ts.Expression,
          );
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
