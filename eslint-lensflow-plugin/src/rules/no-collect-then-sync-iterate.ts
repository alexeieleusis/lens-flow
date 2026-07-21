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

function isCollectionArray(type: ts.Type): boolean {
  const props = type.getProperties();
  const hasLength = props.some((p) => p.name === "length");
  const hasPush = props.some((p) => p.name === "push");
  const hasForEach = props.some((p) => p.name === "forEach");
  return hasLength && (hasPush || hasForEach);
}

export default createRule({
  name: "no-collect-then-sync-iterate",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow collecting an AsyncIterable into an array with await then iterating with synchronous for...of",
    },
    messages: {
      collectThenSyncIterate:
        "Collecting an AsyncIterable into an array then iterating with synchronous for...of defeats streaming. Use for await...of on the original source instead. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"collectThenSyncIterate", []>) {
    const parserServices = ESLintUtils.getParserServices(context);
    const program = parserServices.program;
    if (!program) return {};

    const checker = program.getTypeChecker();

    function checkAwaitedCall(awaitedExpr: TSESTree.Node): boolean {
      if (awaitedExpr.type !== "CallExpression") return false;

      const firstArg = awaitedExpr.arguments[0];
      if (firstArg?.type !== "Identifier") return false;

      const tsFirstArg = parserServices.esTreeNodeToTSNodeMap.get(firstArg);
      if (!tsFirstArg) return false;

      const argType = checker.getTypeAtLocation(tsFirstArg as ts.Expression);

      if (!hasAsyncIteratorSignature(argType, checker)) return false;

      const tsCallNode = parserServices.esTreeNodeToTSNodeMap.get(awaitedExpr);
      if (!tsCallNode) return false;

      const callType = checker.getTypeAtLocation(tsCallNode as ts.Expression);

      const awaitedType = checker.getAwaitedType(callType);
      return awaitedType ? isCollectionArray(awaitedType) : false;
    }

    return {
      ForOfStatement(node) {
        if (node.await) return;

        if (node.right.type !== "Identifier") return;

        const rightIdent = node.right;
        const scope = context.sourceCode.getScope(rightIdent);
        const variable = findVariableByReference(scope, rightIdent);
        if (!variable || variable.defs.length === 0) return;

        const def = variable.defs.find(
          (d: Definition) => d.node.type === "VariableDeclarator",
        );
        if (def?.node.type !== "VariableDeclarator") return;

        const parent = (def.parent as TSESTree.VariableDeclaration).kind;
        if (parent !== "const") return;

        const declarator = def.node as TSESTree.VariableDeclarator;
        const init = declarator.init;
        if (init?.type !== "AwaitExpression") return;

        const awaitedExpr = init.argument;

        if (!checkAwaitedCall(awaitedExpr)) return;

        const tsRight = parserServices.esTreeNodeToTSNodeMap.get(rightIdent);
        if (!tsRight) return;

        const rightType = checker.getTypeAtLocation(tsRight as ts.Expression);
        if (!isCollectionArray(rightType)) return;

        context.report({
          node,
          messageId: "collectThenSyncIterate",
          data: { url: URL },
        });
      },
    };
  },
});
