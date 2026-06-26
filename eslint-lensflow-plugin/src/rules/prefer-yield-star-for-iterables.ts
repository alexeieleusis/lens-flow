import ts from "typescript";
import { ESLintUtils, TSESLint, TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const RULE_URL = knowledgeUrl("usecases/UC21-async-concurrency.md");

function isArrayOrIterable(checker: ts.TypeChecker, argType: ts.Type): boolean {
  if (checker.isArrayType(argType)) return true;

  const primitiveFlags =
    ts.TypeFlags.String |
    ts.TypeFlags.Number |
    ts.TypeFlags.Boolean |
    ts.TypeFlags.Null |
    ts.TypeFlags.Undefined |
    ts.TypeFlags.StringLiteral |
    ts.TypeFlags.NumberLiteral |
    ts.TypeFlags.BooleanLiteral |
    ts.TypeFlags.BigInt |
    ts.TypeFlags.BigIntLiteral |
    ts.TypeFlags.ESSymbol |
    ts.TypeFlags.UniqueESSymbol;
  if (
    (argType.flags & primitiveFlags) !== 0 ||
    (argType.flags & ts.TypeFlags.Object) === 0
  ) {
    return false;
  }

  // Authoritative iterator protocol check via TypeChecker
  if (checker.getPropertyOfType(argType, "[Symbol.iterator]")) return true;
  if (checker.getPropertyOfType(argType, "[Symbol.asyncIterator]")) return true;

  for (const prop of argType.getProperties()) {
    const propName = prop.name;
    if (
      propName === "[Symbol.iterator]" ||
      propName === "[Symbol.asyncIterator]" ||
      propName === "forEach" ||
      propName === "map" ||
      propName === "filter" ||
      propName === "length"
    ) {
      return true;
    }
  }

  return false;
}

function findEnclosingFunction(
  ancestors: TSESTree.Node[],
): { generator: boolean; async: boolean } | null {
  for (const node of ancestors) {
    if (
      node.type === "FunctionDeclaration" ||
      node.type === "FunctionExpression" ||
      node.type === "ArrowFunctionExpression"
    ) {
      return {
        generator: node.generator ?? false,
        async: node.async ?? false,
      };
    }
  }
  return null;
}

export default createRule({
  name: "prefer-yield-star-for-iterables",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require yield* instead of yield when emitting arrays or iterables from async generators",
    },
    messages: {
      preferYieldStar:
        "Using 'yield' on an iterable yields the entire collection as a single element. Use 'yield*' to emit individual items. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"preferYieldStar", []>) {
    const parserServices = ESLintUtils.getParserServices(context, { allowNoProject: true });
    const program = parserServices.program;
    if (!program) return {};

    const checker = program.getTypeChecker();

    return {
      YieldExpression(yieldNode) {
        if (yieldNode.delegate) return;
        if (!yieldNode.argument) return;

        const enclosingFn = findEnclosingFunction(
          context.sourceCode.getAncestors(yieldNode),
        );
        if (!enclosingFn || !enclosingFn.generator || !enclosingFn.async) return;

        const tsArg =
          parserServices.esTreeNodeToTSNodeMap.get(yieldNode.argument);
        if (!tsArg) return;

        const argType = checker.getTypeAtLocation(
          tsArg as ts.Expression,
        );

        if (isArrayOrIterable(checker, argType)) {
          context.report({
            node: yieldNode,
            messageId: "preferYieldStar",
            data: { url: RULE_URL },
          });
        }
      },
    };
  },
});
