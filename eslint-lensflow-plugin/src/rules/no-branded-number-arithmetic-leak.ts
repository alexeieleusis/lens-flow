import ts from "typescript";
import { ESLintUtils, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T03-newtypes-opaque.md");

const ARITHMETIC_OPS = new Set(["+", "-", "*", "/", "%"]);

function hasBrandProperty(constituent: ts.Type): boolean {
  if ((constituent.flags & ts.TypeFlags.Object) !== 0) {
    const props = (constituent as ts.ObjectType).getProperties();
    return props.some((p) => {
      const name = p.escapedName.toString();
      return (
        name === "_brand" ||
        name === "__brand" ||
        name.endsWith("_brand") ||
        name.endsWith("Brand")
      );
    });
  }
  return false;
}

function isBrandedNumber(checker: ts.TypeChecker, tsType: ts.Type): boolean {
  const apparent = checker.getApparentType(tsType);

  const constituents = (apparent as ts.IntersectionType)?.types;
  if (!constituents || constituents.length <= 1) return false;

  let hasNumber = false;
  let hasBrand = false;

  for (const constituent of constituents) {
    const typeStr = checker.typeToString(constituent).trim();
    if (
      (constituent.flags & ts.TypeFlags.Number) !== 0 ||
      typeStr.toLowerCase() === "number"
    ) {
      hasNumber = true;
    }
    if (hasBrandProperty(constituent)) {
      hasBrand = true;
    }
  }

  return hasNumber && hasBrand;
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
      leak: "Arithmetic operation on branded number produces plain `number`, dropping the brand. Re-wrap the result with `as {{brandType}}` or use a dedicated function that preserves the brand. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"leak", []>) {
    const parserServices = ESLintUtils.getParserServices(context, true);
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
        if (
          parent?.type === "TSAsExpression" ||
          parent?.type === "TSTypeAssertion"
        ) {
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
