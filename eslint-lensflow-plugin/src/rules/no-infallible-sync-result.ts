import ts from "typescript";
import { ESLintUtils, TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

const URL =
  "https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T12-effect-tracking.md";

function hasFailureInValue(val: unknown): boolean {
  if (Array.isArray(val)) {
    return val.some((child) => hasFailurePath(child));
  }
  if (typeof val === "object" && val) {
    return hasFailurePath(val);
  }
  return false;
}

function hasFailurePath(n: unknown): boolean {
  if (!n || typeof n !== "object") return false;
  const node = n as Record<string, unknown>;
  const t = node.type as string;

  if (t === "AwaitExpression") return true;
  if (t === "ThrowStatement") return true;
  if (t === "TryStatement") return true;

  for (const key of Object.keys(node)) {
    if (key === "type" || key === "loc" || key === "range" || key === "parent") continue;
    if (hasFailureInValue(node[key])) return true;
  }
  return false;
}

function isSyncBody(body: TSESTree.Node): boolean {
  if (body.type !== "BlockStatement") return true;
  const stmts = body.body;
  return !stmts.some((stmt) => hasFailurePath(stmt));
}

function isAsyncNamedFunction(
  node:
    | TSESTree.FunctionDeclaration
    | TSESTree.FunctionExpression
    | TSESTree.ArrowFunctionExpression,
): boolean {
  return (
    (node.type === "FunctionDeclaration" || node.type === "FunctionExpression") &&
    node.async
  );
}

export default createRule({
  name: "no-infallible-sync-result",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow synchronous functions with no failure path from returning Result<T, never> instead of the plain value.",
     },
    messages: {
      infallibleSyncResult:
        "Synchronous function with no failure path returns Result<T, never>. Return the plain value directly. See: {{url}}",
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

      const typeArgs = typeAnnotation.typeArguments?.params;
      if (!typeArgs || typeArgs.length < 2) return;

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
      if (node.type === "ArrowFunctionExpression") {
        const body = node.body;
        if (body.type === "AwaitExpression") return;
      }

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
