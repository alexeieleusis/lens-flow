import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

function findParentFunction(ancestors: TSESTree.Node[]): TSESTree.FunctionLike | null {
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const node = ancestors[i];
    if (
      node.type === "FunctionDeclaration" ||
      node.type === "FunctionExpression" ||
      node.type === "ArrowFunctionExpression"
    )
      return node as TSESTree.FunctionLike;
  }
  return null;
}

export default createRule({
  name: "no-runtime-filter-as-t",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow casting a runtime .filter() result back to a generic type parameter",
    },
    messages: {
      runtimeFilterCastGeneric:
        "Casting a runtime .filter() result to a generic type parameter falsely claims type-level precision. Use a concrete return type instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T45-paramspec-variadic.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"runtimeFilterCastGeneric", []>) {
    function checkAsExpression(asNode: TSESTree.TSAsExpression): void {
      if (asNode.typeAnnotation.type !== "TSTypeReference") return;

      const typeRef = asNode.typeAnnotation;
      if (typeRef.typeName.type !== "Identifier") return;

      const func = findParentFunction(context.sourceCode.getAncestors(asNode));
      if (!func?.typeParameters) return;

      const typeParamNames = new Set(
        func.typeParameters.params.map((p) => p.name.name),
      );
      const castTarget = typeRef.typeName.name;
      if (!typeParamNames.has(castTarget)) return;

      const innerExpr = asNode.expression;
      if (innerExpr.type !== "CallExpression") return;
      if ((innerExpr.callee as TSESTree.MemberExpression).type !== "MemberExpression")
        return;
      const callee = innerExpr.callee as TSESTree.MemberExpression;
      if (callee.property.type !== "Identifier" || callee.property.name !== "filter")
        return;

      context.report({
        node: asNode,
        messageId: "runtimeFilterCastGeneric",
      });
    }

    return {
      "ReturnStatement > TSAsExpression"(node: TSESTree.TSAsExpression) {
        checkAsExpression(node);
      },

      "ArrowFunctionExpression[expression=true] > TSAsExpression"(
        node: TSESTree.TSAsExpression,
      ) {
        checkAsExpression(node);
      },
    };
  },
});
