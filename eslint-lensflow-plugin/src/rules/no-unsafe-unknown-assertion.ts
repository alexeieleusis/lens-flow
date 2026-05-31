import ts from "typescript";
import { ESLintUtils, type TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

const URL =
  "https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T07-structural-typing.md";

function isInsideTypePredicateFn(node: TSESTree.Node): boolean {
  let current: TSESTree.Node | undefined = node.parent;
  while (current) {
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
    current = current.parent;
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
    const parserServices = ESLintUtils.getParserServices(context);
    const program = parserServices.program;
    if (!program) return {};

    const checker = program.getTypeChecker();

    return {
      TSAsExpression(node) {
        if (isInsideTypePredicateFn(node)) return;

        const exprTs =
          parserServices.esTreeNodeToTSNodeMap.get(node.expression);
        if (!exprTs) return;

        const exprType = checker.getTypeAtLocation(exprTs as ts.Expression);
        const typeStr = checker.typeToString(exprType);

        if (typeStr !== "unknown") return;

        const typeNodeTs =
          parserServices.esTreeNodeToTSNodeMap.get(node.typeAnnotation);
        if (!typeNodeTs) return;

        const targetType = checker.getTypeFromTypeNode(
          typeNodeTs as ts.TypeNode,
        );
        const targetTypeStr = checker.typeToString(targetType);

        if (["unknown", "any", "never"].includes(targetTypeStr)) return;

        context.report({
          node,
          messageId: "unsafeCast",
          data: {
            targetType: targetTypeStr,
            url: URL,
          },
        });
      },
    };
  },
});
