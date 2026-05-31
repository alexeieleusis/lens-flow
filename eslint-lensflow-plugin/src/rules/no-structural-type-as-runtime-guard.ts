import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

function isAsAnyExpression(node: TSESTree.Node): node is TSESTree.TSAsExpression {
  return (
    node.type === "TSAsExpression" &&
    node.typeAnnotation.type === "TSAnyKeyword"
  );
}

function isASTNode(value: unknown): value is TSESTree.Node {
  return value != null && typeof value === "object" && "type" in value;
}

function* iterateChildNodes(node: TSESTree.Node): IterableIterator<TSESTree.Node> {
  const record = node as unknown as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key === "parent" || key === "loc" || key === "range") continue;
    const child = record[key];
    if (!child || typeof child !== "object") continue;

    if (Array.isArray(child)) {
      for (const item of child) {
        if (isASTNode(item)) {
          yield item;
        }
      }
    } else if (isASTNode(child)) {
      yield child;
    }
  }
}

function findAsAnyInReturn(node: TSESTree.Node): TSESTree.TSAsExpression | null {
  if (isAsAnyExpression(node)) {
    return node;
  }

  for (const child of iterateChildNodes(node)) {
    const found = findAsAnyInReturn(child);
    if (found) return found;
  }
  return null;
}

function hasUnknownParam(
  node: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression,
): boolean {
  return node.params.some(
    (param) =>
      param.type === "Identifier" &&
      param.typeAnnotation?.typeAnnotation?.type === "TSUnknownKeyword",
  );
}

export default createRule({
  name: "no-structural-type-as-runtime-guard",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallows casting `unknown` to `any` as a fake runtime guard, which performs no actual validation because types are erased at runtime.",
    },
    messages: {
      structuralAsAnyGuard:
        "Casting `unknown` to `any` performs no runtime validation. Write an actual type guard or parser instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/usecases/UC05-structural-contracts.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"structuralAsAnyGuard", []>) {
    function checkFunction(
      node: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression,
    ): void {
      if (!hasUnknownParam(node)) return;

      if (node.body.type === "BlockStatement") {
        for (const stmt of node.body.body) {
          if (stmt.type === "ReturnStatement" && stmt.argument) {
            const asAny = findAsAnyInReturn(stmt.argument);
            if (asAny) {
              context.report({
                node: asAny,
                messageId: "structuralAsAnyGuard",
              });
            }
          }
        }
      }
    }

    return {
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction,
    };
  },
});
