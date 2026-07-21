import ts from "typescript";
import { ESLintUtils, type TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const DOCS_URL = knowledgeUrl("catalog/T18-conversions-coercions.md");

function isAsConst(node: TSESTree.TSAsExpression): boolean {
  const ta = node.typeAnnotation;
  if (ta.type !== "TSTypeReference") return false;
  const tn = ta.typeName;
  return tn.type === "Identifier" && tn.name === "const";
}

export default createRule({
  name: "no-as-instead-of-narrowing",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `as T` to narrow a union-typed variable to one of its members. Use a runtime type guard (typeof, instanceof, or user-defined type predicate) instead.",
    },
    messages: {
      narrowViaAs:
        "Using `as {{targetType}}` to narrow a value of type `{{sourceType}}`. Use a runtime type guard (typeof, instanceof, or custom type predicate) instead. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"narrowViaAs", []>) {
    const parserServices = ESLintUtils.getParserServices(context, true);
    const program = parserServices.program;
    if (!program) return {};

    const checker = program.getTypeChecker();

    return {
      TSAsExpression(node) {
        if (isAsConst(node)) return;

        const exprTs = parserServices.esTreeNodeToTSNodeMap.get(
          node.expression,
        );
        if (!exprTs) return;

        const exprType = checker.getTypeAtLocation(exprTs as ts.Expression);

        if ((exprType.flags & ts.TypeFlags.Union) === 0) return;

        const unionType = exprType as ts.UnionType;
        const constituents = unionType.types;

        if (constituents.length < 2) return;

        const typeNodeTs = parserServices.esTreeNodeToTSNodeMap.get(
          node.typeAnnotation,
        );
        if (!typeNodeTs) return;

        const targetType = checker.getTypeFromTypeNode(
          typeNodeTs as ts.TypeNode,
        );

        const isConstituent = constituents.some((c) =>
          checker.isTypeAssignableTo(targetType, c),
        );

        if (!isConstituent) return;

        if (checker.isTypeAssignableTo(exprType, targetType)) return;

        context.report({
          node,
          messageId: "narrowViaAs",
          data: {
            targetType: checker.typeToString(targetType),
            sourceType: checker.typeToString(exprType),
            url: DOCS_URL,
          },
        });
      },
    };
  },
});
