import ts from "typescript";
import { ESLintUtils, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("usecases/UC16-nullability.md");

export default createRule({
  name: "no-unsafe-non-null-assertion",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow the non-null assertion operator (`!`) on values whose type includes null or undefined.",
    },
    messages: {
      unsafeNonNull:
        "Using `!` on a nullable value suppresses compile-time safety with no runtime guarantee. Add a null check or use optional chaining instead. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"unsafeNonNull", []>) {
    const parserServices = ESLintUtils.getParserServices(context, { allowEmptyOrMissing: true });
    const program = parserServices.program;
    if (!program) return {};

    const checker = program.getTypeChecker();

    return {
      TSNonNullExpression(node) {
        const exprTs = parserServices.esTreeNodeToTSNodeMap.get(
          node.expression,
        );
        if (!exprTs) return;

        const exprType = checker.getTypeAtLocation(exprTs as ts.Expression);
        const constituents = (exprType as ts.UnionType).types || [exprType];

        const isNullable = constituents.some((t) => {
          const typeName = checker.typeToString(t);
          return typeName === "null" || typeName === "undefined";
        });
        if (!isNullable) return;

        context.report({
          node,
          messageId: "unsafeNonNull",
          data: { url: URL },
        });
      },
    };
  },
});
