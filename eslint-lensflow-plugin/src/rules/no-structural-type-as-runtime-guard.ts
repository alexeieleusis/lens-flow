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

function* findAllReturnStatements(node: TSESTree.Node): IterableIterator<TSESTree.ReturnStatement> {
  if (node.type === "ReturnStatement") {
    yield node;
  }
  for (const child of iterateChildNodes(node)) {
    yield* findAllReturnStatements(child);
  }
}

function containsUnknown(typeAnnotation: TSESTree.TypeNode): boolean {
  if (typeAnnotation.type === "TSUnknownKeyword") return true;
  if (typeAnnotation.type === "TSArrayType" && containsUnknown(typeAnnotation.elementType)) return true;
  return false;
}

function hasUnknownParam(
  node: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression,
): boolean {
  return node.params.some((param) => {
    // Identifier: `(v: unknown)`
    if (param.type === "Identifier" && param.typeAnnotation?.typeAnnotation) {
      return containsUnknown(param.typeAnnotation.typeAnnotation);
    }
    // ObjectPattern / ArrayPattern (destructuring): `({ x }: unknown)` or `([x]: unknown[])`
    if ((param.type === "ObjectPattern" || param.type === "ArrayPattern") && param.typeAnnotation?.typeAnnotation) {
      return containsUnknown(param.typeAnnotation.typeAnnotation);
    }
    // RestElement: `(...args: unknown[])`
    if (param.type === "RestElement" && param.typeAnnotation?.typeAnnotation) {
      return containsUnknown(param.typeAnnotation.typeAnnotation);
    }
    // AssignmentPattern (default value): `(v: unknown = {})`
    if (param.type === "AssignmentPattern") {
      const left = param.left;
      if (left.type === "Identifier" && left.typeAnnotation?.typeAnnotation) {
        return containsUnknown(left.typeAnnotation.typeAnnotation);
      }
      if ((left.type === "ObjectPattern" || left.type === "ArrayPattern") && left.typeAnnotation?.typeAnnotation) {
        return containsUnknown(left.typeAnnotation.typeAnnotation);
      }
    }
    return false;
  });
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
        "Casting `unknown` to `any` performs no runtime validation. Write an actual type guard or parser instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC05-structural-contracts.md",
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
        for (const returnStmt of findAllReturnStatements(node.body)) {
          if (returnStmt.argument) {
            const asAny = findAsAnyInReturn(returnStmt.argument);
            if (asAny) {
              context.report({
                node: asAny,
                messageId: "structuralAsAnyGuard",
              });
            }
          }
        }
      } else {
        const asAny = findAsAnyInReturn(node.body);
        if (asAny) {
          context.report({
            node: asAny,
            messageId: "structuralAsAnyGuard",
          });
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
