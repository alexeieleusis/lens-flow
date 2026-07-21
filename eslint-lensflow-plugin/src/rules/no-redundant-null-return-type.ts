import ts from "typescript";
import { ESLintUtils, TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import { walk } from "../utils/ast-helpers.js";

const KNOWLEDGE_URL = knowledgeUrl("usecases/UC16-nullability.md");

function hasNullableMember(typeAnnotation: TSESTree.TypeNode): boolean {
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

function hasNullableConstituent(type: ts.Type): boolean {
  const flag = ts.TypeFlags.Null | ts.TypeFlags.Undefined;
  if (type.isUnion()) {
    for (const t of type.types) {
      if ((t.flags & flag) !== 0) return true;
    }
  }
  return (type.flags & flag) !== 0;
}

function collectReturnStatements(
  body: TSESTree.Node,
): TSESTree.ReturnStatement[] {
  const returns: TSESTree.ReturnStatement[] = [];
  walk(body, (node) => {
    if (node.type === "ReturnStatement") {
      returns.push(node);
    }
  });
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
    const parserServices = ESLintUtils.getParserServices(context, true);
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

      // For expression-bodied arrows, the body itself is the implicit return expression.
      if (node.body?.type !== "BlockStatement") {
        const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node.body);
        const bodyType = checker.getTypeAtLocation(tsNode);

        const bodyIsNullable = hasNullableConstituent(bodyType);

        if (!bodyIsNullable) {
          context.report({
            node,
            messageId: "redundantNullReturnType",
            data: { url: KNOWLEDGE_URL },
          });
        }
        return;
      }

      const returns = collectReturnStatements(node.body);

      // Functions with zero explicit returns implicitly return undefined.
      // If the declared return type includes undefined, it's NOT redundant — skip.
      if (returns.length === 0) {
        return;
      }

      const allReturnsNonNullable = returns.every((retStmt) => {
        if (retStmt.argument === null) {
          return false;
        }

        const tsExpr = parserServices.esTreeNodeToTSNodeMap.get(
          retStmt.argument,
        ) as ts.Expression | undefined;
        if (!tsExpr) return false;

        const returnType = checker.getTypeAtLocation(tsExpr);
        return !hasNullableConstituent(returnType);
      });

      if (allReturnsNonNullable) {
        context.report({
          node,
          messageId: "redundantNullReturnType",
          data: { url: KNOWLEDGE_URL },
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
