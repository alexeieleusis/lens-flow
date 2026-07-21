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

  // Check iterator protocol via Symbol properties
  if (checker.getPropertyOfType(argType, "[Symbol.iterator]")) return true;
  if (checker.getPropertyOfType(argType, "[Symbol.asyncIterator]")) return true;

  // Fallback: check type name for known iterable types.
  // This catches generic Iterable<T>, Set, Map, etc. where symbol properties
  // may not resolve via getPropertyOfType.
  const typeStr = checker.typeToString(argType);
  const iterablePrefixes = [
    "Iterable<",
    "AsyncIterable<",
    "Set<",
    "Map<",
    "WeakSet<",
    "WeakMap<",
    "SetIterator<",
    "MapIterator<",
    "Int8Array",
    "Uint8Array",
    "Uint8ClampedArray",
    "Int16Array",
    "Uint16Array",
    "Int32Array",
    "Uint32Array",
    "Float32Array",
    "Float64Array",
    "BigInt64Array",
    "BigUint64Array",
    "Generator<",
    "AsyncGenerator<",
  ];
  if (iterablePrefixes.some((p) => typeStr.startsWith(p))) return true;

  // Check base types for known iterable interfaces
  if (argType.isClassOrInterface()) {
    const bases = argType.getBaseTypes();
    if (bases) {
      for (const base of bases) {
        if (isArrayOrIterable(checker, base)) return true;
      }
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
    const parserServices = ESLintUtils.getParserServices(context, true);
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
        if (!enclosingFn || !enclosingFn.generator || !enclosingFn.async)
          return;

        const tsArg = parserServices.esTreeNodeToTSNodeMap.get(
          yieldNode.argument,
        );
        if (!tsArg) return;

        const argType = checker.getTypeAtLocation(tsArg as ts.Expression);

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
