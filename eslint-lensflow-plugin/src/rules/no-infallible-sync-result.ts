import ts from "typescript";
import { ESLintUtils, TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import { walkNodes } from "../utils/ast-helpers.js";

const URL = knowledgeUrl("catalog/T12-effect-tracking.md");

function getTypeArgs(
  node: TSESTree.TSTypeReference,
): TSESTree.TypeNode[] | null {
  const args = node.typeArguments?.params;
  if (!args || args.length < 2) return null;
  return args;
}

function hasFailurePath(node: TSESTree.Node): boolean {
  return (
    node.type === "AwaitExpression" ||
    node.type === "ThrowStatement" ||
    node.type === "TryStatement"
  );
}

function isSyncBody(body: TSESTree.Node): boolean {
  // Expression-bodied arrows (non-BlockStatement) are treated as sync with no
  // failure path. Expression-body specific failure patterns (throw, await)
  // are handled by early returns in checkFunction before this is called.
  if (body.type !== "BlockStatement") return true;
  const stmts = body.body;
  return !stmts.some((stmt) =>
    walkNodes(stmt, hasFailurePath, { stopAtFunctionBoundaries: true }),
  );
}

function isAsyncNamedFunction(
  node:
    | TSESTree.FunctionDeclaration
    | TSESTree.FunctionExpression
    | TSESTree.ArrowFunctionExpression,
): boolean {
  return (
    (node.type === "FunctionDeclaration" ||
      node.type === "FunctionExpression") &&
    node.async
  );
}

function hasAsyncArrowBody(node: TSESTree.ArrowFunctionExpression): boolean {
  return node.body.type === "AwaitExpression";
}

export default createRule({
  name: "no-infallible-sync-result",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow synchronous functions with no failure path from returning Result<T, never> or Either<never, T> instead of the plain value.",
    },
    messages: {
      infallibleSyncResult:
        "Synchronous function with no failure path returns Result<T, never> or Either<never, T>. Return the plain value directly. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"infallibleSyncResult", []>) {
    const parserServices = ESLintUtils.getParserServices(context);
    const program = parserServices.program;
    if (!program) return {};

    const checker = program.getTypeChecker();
    const neverType = checker.getNeverType();

    function checkFunction(
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression,
    ) {
      if (!node.returnType?.typeAnnotation) return;

      const typeAnnotation = node.returnType.typeAnnotation;

      if (typeAnnotation.type !== "TSTypeReference") return;

      const typeNameNode = typeAnnotation.typeName;
      if (typeNameNode.type !== "Identifier") return;

      const typeName = typeNameNode.name;
      if (typeName !== "Result" && typeName !== "Either") return;

      if (node.typeParameters) return;

      const typeArgs = getTypeArgs(typeAnnotation);
      if (!typeArgs) return;

      const errorArgIndex = typeName === "Result" ? 1 : 0;
      const errorArgNode = typeArgs[errorArgIndex];

      const tsErrorArg = parserServices.esTreeNodeToTSNodeMap.get(
        errorArgNode,
      ) as ts.TypeNode | undefined;
      if (!tsErrorArg) return;

      const errorType = checker.getTypeFromTypeNode(tsErrorArg);

      if (
        !checker.isTypeAssignableTo(errorType, neverType) ||
        !checker.isTypeAssignableTo(neverType, errorType)
      ) {
        return;
      }

      if (isAsyncNamedFunction(node)) return;
      if (node.type === "ArrowFunctionExpression" && hasAsyncArrowBody(node)) {
        return;
      }

      if (!node.body) return;
      if (!isSyncBody(node.body)) return;

      context.report({
        node,
        messageId: "infallibleSyncResult",
        data: { url: URL },
      });
    }

    return {
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction,
    };
  },
});
