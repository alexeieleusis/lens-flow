import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T45-paramspec-variadic.md");

function* iterateAncestorFunctions(
  ancestors: TSESTree.Node[],
): Generator<TSESTree.FunctionLike> {
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const node = ancestors[i];
    if (
      node.type === "FunctionDeclaration" ||
      node.type === "FunctionExpression" ||
      node.type === "ArrowFunctionExpression"
    ) {
      yield node as TSESTree.FunctionLike;
    }
  }
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
        "Casting a runtime .filter() result to a generic type parameter falsely claims type-level precision. Use a concrete return type instead. See: {{url}}",
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

      const castTarget = typeRef.typeName.name;
      const ancestors = context.sourceCode.getAncestors(asNode);
      let matched = false;
      for (const func of iterateAncestorFunctions(ancestors)) {
        if (!func.typeParameters) continue;
        const typeParamNames = new Set(
          func.typeParameters.params.map((p) => p.name.name),
        );
        if (typeParamNames.has(castTarget)) {
          matched = true;
          break;
        }
      }
      if (!matched) return;

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
        data: {
          url: URL,
        },
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
