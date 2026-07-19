import ts from "typescript";
import { ESLintUtils, TSESTree, TSESLint } from "@typescript-eslint/utils";
import type { Definition } from "@typescript-eslint/scope-manager";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import {
  hasAsyncIteratorSignature,
  findVariableByReference,
} from "../utils/async-iteration.js";

const URL = knowledgeUrl("catalog/T64-async-iteration.md");

const ARRAY_TRANSFORM_METHODS = new Set([
  "map",
  "filter",
  "reduce",
  "flatMap",
  "some",
  "every",
  "find",
  "findIndex",
  "sort",
  "slice",
  "splice",
  "concat",
  "join",
  "flat",
  "toSorted",
  "toReversed",
  "toSpliced",
  "with",
  "findLast",
  "findLastIndex",
  "reduceRight",
]);

function hasBeenReassigned(
  variable: TSESLint.Scope.Variable,
  declarator: TSESTree.VariableDeclarator,
  transformCall: TSESTree.CallExpression,
): boolean {
  for (const reference of variable.references) {
    if (!reference.identifier) continue;
    if (!reference.isWrite()) continue;

    const refRange = reference.identifier.range;
    const declRange = declarator.range;
    const callRange = transformCall.range;

    if (refRange[0] > declRange[1] && refRange[0] < callRange[0]) {
      return true;
    }
  }
  return false;
}

function isArrayType(checker: ts.TypeChecker, type: ts.Type): boolean {
  if (checker.isArrayType(type)) return true;
  return checker.typeToString(type).startsWith("ReadonlyArray<");
}

function unwrapToAwait(
  n: TSESTree.Node,
): TSESTree.AwaitExpression | null {
  let current: TSESTree.Node = n;
  while (
    current.type === "TSAsExpression" ||
    current.type === "TSTypeAssertion" ||
    current.type === "TSNonNullExpression" ||
    current.type === "TSSatisfiesExpression"
  ) {
    current = current.expression;
  }
  return current.type === "AwaitExpression" ? current : null;
}

export default createRule({
  name: "no-collect-then-transform",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow collecting an AsyncIterable into an array with await then applying .map() or similar array transformation",
     },
    messages: {
      collectThenTransform:
        `Collecting an AsyncIterable into an array then applying "{{method}}" consumes O(n) memory instead of streaming. Use an async generator pipeline with for await...of instead. See: {{url}}`,
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"collectThenTransform", []>) {
    const parserServices = ESLintUtils.getParserServices(context);
    const program = parserServices.program;
    if (!program) return {};

    const checker = program.getTypeChecker();

    function isAsyncIterableCall(awaitedExpr: TSESTree.Node): boolean {
      if (awaitedExpr.type !== "CallExpression") return false;

      const firstArg = awaitedExpr.arguments[0];
      if (!firstArg) return false;

      const tsFirstArg =
        parserServices.esTreeNodeToTSNodeMap.get(firstArg);
      if (!tsFirstArg) return false;

      const argType = checker.getTypeAtLocation(
        tsFirstArg as ts.Expression,
      );

      return hasAsyncIteratorSignature(argType, checker);
    }

    function checkIdentifierObject(
      obj: TSESTree.Identifier,
      methodName: string,
      callNode: TSESTree.CallExpression,
    ) {
      const scope = context.sourceCode.getScope(obj);
      const variable = findVariableByReference(scope, obj);
      if (!variable || variable.defs.length === 0) return;

      const def = variable.defs.find(
        (d: Definition) => d.node.type === "VariableDeclarator",
      );
      if (def?.node.type !== "VariableDeclarator") return;

      const declarator = def.node as TSESTree.VariableDeclarator;
      const init = declarator.init;
      if (!init) return;

      const awaited = unwrapToAwait(init);
      if (!awaited) return;

      if (!isAsyncIterableCall(awaited.argument)) return;
      if (hasBeenReassigned(variable, declarator, callNode)) return;

      const tsVarIdent = parserServices.esTreeNodeToTSNodeMap.get(obj);
      if (!tsVarIdent) return;

      if (!isArrayType(checker, checker.getTypeAtLocation(tsVarIdent as ts.Expression))) return;

      context.report({
        node: init,
        messageId: "collectThenTransform",
        data: { method: methodName, url: URL },
      });
    }

    function checkDirectObject(
      obj: TSESTree.Node,
      methodName: string,
    ) {
      const awaited = unwrapToAwait(obj);
      if (!awaited) return;

      const awaitedArg = awaited.argument;
      if (
        awaitedArg.type !== "CallExpression" ||
        !isAsyncIterableCall(awaitedArg)
      )
        return;

      const tsAwaited = parserServices.esTreeNodeToTSNodeMap.get(awaited);
      if (!tsAwaited) return;

      if (!isArrayType(checker, checker.getTypeAtLocation(tsAwaited as ts.Expression))) return;

      context.report({
        node: awaited,
        messageId: "collectThenTransform",
        data: { method: methodName, url: URL },
      });
    }

    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== "MemberExpression") return;
        if (callee.property.type !== "Identifier") return;
        if (callee.optional) return;

        const methodName = callee.property.name;
        if (!ARRAY_TRANSFORM_METHODS.has(methodName)) return;

        if (callee.object.type === "Identifier") {
          checkIdentifierObject(callee.object, methodName, node);
        } else {
          checkDirectObject(callee.object, methodName);
        }
      },
    };
  },
});
