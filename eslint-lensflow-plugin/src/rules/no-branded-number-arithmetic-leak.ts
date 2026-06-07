import ts from "typescript";
import { ESLintUtils, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

const URL =
  "https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T03-newtypes-opaque.md";

const ARITHMETIC_OPS = new Set(["+", "-", "*", "/", "%"]);

function isBrandedNumber(checker: ts.TypeChecker, tsType: ts.Type): boolean {
  const apparent = checker.getApparentType(tsType);

  const constituents = (apparent as ts.IntersectionType)?.types;
  if (!constituents || constituents.length < 2) return false;

  let hasNumber = false;
  let hasBrandObject = false;

  for (const constituent of constituents) {
    const typeStr = checker.typeToString(constituent).trim();
    if (
      (constituent.flags & ts.TypeFlags.Number) !== 0 ||
      typeStr.toLowerCase() === "number"
    ) {
      hasNumber = true;
    }

    if ((constituent.flags & ts.TypeFlags.Object) !== 0) {
      const props = (constituent as ts.ObjectType).getProperties();
      if (
        props.some((p) => {
          const propName = p.escapedName.toString();
          // TypeScript escapes string-literal property names by prepending underscore,
          // so "__brand" becomes "___brand" internally
          const unescaped = propName.startsWith("_")
            ? propName.replace(/^_+/, (m) => m.slice(1))
            : propName;
          return (
            unescaped === "_brand" ||
            unescaped === "__brand" ||
            unescaped.endsWith("Brand") ||
            propName === "_brand" ||
            propName === "__brand" ||
            propName.endsWith("Brand")
          );
        })
      ) {
        hasBrandObject = true;
      }
    }
  }

  return hasNumber && hasBrandObject;
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
