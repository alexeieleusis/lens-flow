import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { walkNodes } from "../utils/ast-helpers.js";

function hasThrowStatement(
  body: TSESTree.Statement | TSESTree.BlockStatement | null,
): boolean {
  if (!body) return false;

  return walkNodes(body, (node) => {
    if (node.type === "ThrowStatement") return true;
    if (
      node.type === "CallExpression" &&
      node.callee.type === "Identifier" &&
      node.callee.name.startsWith("assert")
    ) {
      return true;
    }
    return false;
  });
}

export default createRule({
  name: "require-assertion-throw",
  meta: {
    type: "problem",
    docs: {
      description:
        "Enforce that assertion functions contain a throw statement",
    },
    messages: {
      missingThrow:
        "Assertion function must contain a throw statement to provide runtime safety. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T14-type-narrowing.md",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"missingThrow", []>) {
    type AssertionFnNode =
      | TSESTree.FunctionDeclaration
      | TSESTree.FunctionExpression
      | TSESTree.ArrowFunctionExpression
      | TSESTree.TSDeclareFunction
      | TSESTree.TSMethodSignature
      | TSESTree.TSCallSignatureDeclaration
      | TSESTree.TSConstructSignatureDeclaration;

    function checkFunction(node: AssertionFnNode) {
      if (!node.returnType) return;

      const ann = node.returnType.typeAnnotation;
      if (ann.type !== "TSTypePredicate" || !ann.asserts) return;

      const hasBody =
        "body" in node &&
        node.body != null &&
        typeof node.body === "object" &&
        "type" in node.body &&
        node.body.type === "BlockStatement";

      if (!hasBody || !hasThrowStatement(node.body as TSESTree.BlockStatement)) {
        context.report({
          node,
          messageId: "missingThrow",
        });
      }
    }

    function checkMethodDefinition(node: TSESTree.MethodDefinition) {
      const value = node.value as TSESTree.Node;
      if (value.type === "FunctionExpression" || value.type === "ArrowFunctionExpression") {
        checkFunction(value);
      }
    }

    return {
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction,
      MethodDefinition: checkMethodDefinition,
      TSDeclareFunction: checkFunction,
      TSMethodSignature: checkFunction,
      TSCallSignatureDeclaration: checkFunction,
      TSConstructSignatureDeclaration: checkFunction,
    };
  },
});
