import ts from "typescript";
import { ESLintUtils, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

const URL =
  "https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T03-newtypes-opaque.md";

const ARITHMETIC_OPS = new Set(["+", "-", "*", "/", "%"]);

function hasBrandProperty(type: ts.Type): boolean {
  const props = type.getProperties();
  return props.some((p) => {
    const name = String(p.name);
    return (
      name === "_brand" ||
      name === "__brand" ||
      name === "___brand" ||
      /Brand$/.test(name)
    );
  });
}

function isNumberLike(checker: ts.TypeChecker, t: ts.Type): boolean {
  if ((t.flags & ts.TypeFlags.Number) !== 0) return true;
  return checker.typeToString(t).trim().toLowerCase() === "number";
}

function checkIntersection(
  checker: ts.TypeChecker,
  candidates: ts.Type[],
): boolean {
  for (const ct of candidates) {
    const constituents = (ct as ts.IntersectionType)?.types;
    if (!constituents || constituents.length < 2) continue;

    let hasNumber = false;
    for (const c of constituents) {
      if (isNumberLike(checker, c)) {
        hasNumber = true;
      } else if (hasBrandProperty(c)) {
        if (hasNumber) return true;
      }
    }
  }
  return false;
}

function isBrandedNumber(checker: ts.TypeChecker, tsType: ts.Type): boolean {
  const resolved =
    (tsType.flags & ts.TypeFlags.Object) !== 0 &&
    ((tsType as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference) !== 0
      ? (tsType as ts.TypeReference).target
      : tsType;

  return checkIntersection(checker, [
    tsType,
    resolved,
    checker.getApparentType(resolved),
  ]);
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
