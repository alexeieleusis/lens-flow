import ts from "typescript";
import { ESLintUtils, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

const URL =
  "https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T03-newtypes-opaque.md";

const ARITHMETIC_OPS = new Set(["+", "-", "*", "/", "%"]);

function hasBrandProperty(type: ts.Type): boolean {
  const props = type.getProperties();
  return props.some((p) => {
    const name = ts.unescapeLeadingUnderscores(p.escapedName as ts.__String);
    return name === "_brand" || name === "__brand" || /Brand$/.test(name);
  });
}

function isBrandedNumber(checker: ts.TypeChecker, tsType: ts.Type): boolean {
  const constituents = (tsType as ts.IntersectionType)?.types;
  if (!constituents || constituents.length < 2) return false;

  let hasNumber = false;
  let hasBrand = false;
  for (const constituent of constituents) {
    if ((constituent.flags & ts.TypeFlags.Number) !== 0) {
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

    return {
      BinaryExpression(node) {
        if (!ARITHMETIC_OPS.has(node.operator)) return;

        const leftTSNode = esTreeNodeToTSNodeMap.get(node.left);
        const rightTSNode = esTreeNodeToTSNodeMap.get(node.right);
        const leftType = leftTSNode ? checker.getTypeAtLocation(leftTSNode) : undefined;
        const rightType = rightTSNode ? checker.getTypeAtLocation(rightTSNode) : undefined;

        const leftBranded = leftType && isBrandedNumber(checker, leftType);
        const rightBranded = rightType && isBrandedNumber(checker, rightType);

        if (!leftBranded && !rightBranded) return;

        const parent = node.parent;
        if (parent?.type === "TSAsExpression" || parent?.type === "TSTypeAssertion") {
          const parentTSNode = esTreeNodeToTSNodeMap.get(parent);
          if (parentTSNode) {
            const castResultType = checker.getTypeAtLocation(parentTSNode);
            if (isBrandedNumber(checker, castResultType)) return;
          }
        }

        const brandedType = leftBranded ? leftType! : rightType!;
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
