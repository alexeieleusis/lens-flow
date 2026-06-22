import ts from "typescript";
import { ESLintUtils, TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("usecases/UC16-nullability.md");

function hasNullableMember(
  typeAnnotation: TSESTree.TypeNode,
): boolean {
  if (
    typeAnnotation.type === "TSNullKeyword" ||
    typeAnnotation.type === "TSUndefinedKeyword"
  ) {
    return true;
  }
  if (typeAnnotation.type === "TSUnionType") {
    return typeAnnotation.types.some(hasNullableMember);
  }
  return false;
}

function isESTreeNode(val: unknown): val is TSESTree.Node {
  return val != null && typeof val === "object" && "type" in val;
}

function collectReturnStatements(body: TSESTree.Node): TSESTree.ReturnStatement[] {
  const returns: TSESTree.ReturnStatement[] = [];

  function walkChildren(node: TSESTree.Node): void {
    for (const key of Object.keys(node)) {
      if (key === "parent") continue;
      const val = (node as unknown as Record<string, unknown>)[key];

      if (Array.isArray(val)) {
        for (const item of val) {
          if (isESTreeNode(item)) {
            walk(item);
          }
        }
      } else if (isESTreeNode(val)) {
        walk(val);
      }
    }
  }

  function walk(node: TSESTree.Node | null | undefined): void {
    if (!node) return;

    if (node.type === "ReturnStatement") {
      returns.push(node);
    }

    walkChildren(node);
  }

  walk(body);
  return returns;
}

export default createRule({
  name: "no-redundant-null-return-type",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow annotating a function return type as T | null when the returned value can never actually be null.",
     },
    messages: {
      redundantNullReturnType:
        "Return type includes null or undefined but no return expression can produce a nullish value. Remove null/undefined from the return type. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"redundantNullReturnType", []>) {
    const parserServices = ESLintUtils.getParserServices(context);
    const program = parserServices.program;
    if (!program) return {};

    const checker = program.getTypeChecker();

    function checkFunction(
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression,
    ) {
      const retType = node.returnType?.typeAnnotation;
      if (!retType) return;

      if (!hasNullableMember(retType)) return;

      if (node.body?.type !== "BlockStatement") return;

      const returns = collectReturnStatements(node.body);

      const allReturnsNonNullable = returns.every((retStmt) => {
        if (retStmt.argument === null) {
          return false;
        }

        const tsExpr = parserServices.esTreeNodeToTSNodeMap.get(
          retStmt.argument,
        ) as ts.Expression | undefined;
        if (!tsExpr) return false;

        const returnType = checker.getTypeAtLocation(tsExpr);
        const constituents = (returnType as ts.UnionType).types || [returnType];

        const isNullable = constituents.some((t) => {
          const typeName = checker.typeToString(t);
          return typeName === "null" || typeName === "undefined";
        });

        return !isNullable;
      });

      if (allReturnsNonNullable && returns.length > 0) {
        context.report({
          node,
          messageId: "redundantNullReturnType",
          data: { url: URL },
        });
      }
    }

    return {
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction,
    };
  },
});
