import { ESLintUtils, TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const KNOWLEDGE_URL = knowledgeUrl("catalog/T07-structural-typing.md");

function isInsideTypePredicateFn(
  context: TSESLint.RuleContext<"unsafeCast", []>,
  node: TSESTree.Node,
): boolean {
  const ancestors = context.sourceCode.getAncestors(node);
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const current = ancestors[i];
    if (
      current.type === "FunctionDeclaration" ||
      current.type === "FunctionExpression" ||
      current.type === "ArrowFunctionExpression"
    ) {
      const returnAnn = current.returnType;
      if (returnAnn?.typeAnnotation.type === "TSTypePredicate") {
        return true;
      }
      break;
    }
  }
  return false;
}

export default createRule({
  name: "no-unsafe-unknown-assertion",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow casting a value of type `unknown` directly to a specific type without a runtime type guard.",
    },
    messages: {
      unsafeCast:
        "Casting `unknown` directly to `{{targetType}}` bypasses all structural safety. Use a runtime type guard before the assertion. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"unsafeCast", []>) {
    const parserServices = ESLintUtils.getParserServices(context, true);
    const program = parserServices.program;
    if (!program) return {};

    const checker = program.getTypeChecker();

    return {
      TSAsExpression(node) {
        if (isInsideTypePredicateFn(context, node)) return;

        const exprType = parserServices.getTypeAtLocation(node.expression);
        const typeStr = checker.typeToString(exprType);

        if (typeStr !== "unknown") return;

        const targetType = parserServices.getTypeAtLocation(node.typeAnnotation);
        const targetTypeStr = checker.typeToString(targetType);

        if (["unknown", "any", "never"].includes(targetTypeStr)) return;

        context.report({
          node,
          messageId: "unsafeCast",
          data: {
            targetType: targetTypeStr,
            url: KNOWLEDGE_URL,
          },
        });
      },
    };
  },
});
