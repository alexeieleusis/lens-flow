import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { walkNodes } from "../utils/ast-helpers.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T14-type-narrowing.md");

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
      description: "Enforce that assertion functions contain a throw statement",
    },
    messages: {
      missingThrow:
        "Assertion function must contain a throw statement to provide runtime safety. See: {{url}}",
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

      if (
        !hasBody ||
        !hasThrowStatement(node.body as TSESTree.BlockStatement)
      ) {
        context.report({
          node,
          messageId: "missingThrow",
          data: { url: URL },
        });
      }
    }

    function checkMethodDefinition(node: TSESTree.MethodDefinition) {
      const value = node.value as TSESTree.Node;
      if (
        value.type === "FunctionExpression" ||
        value.type === "ArrowFunctionExpression"
      ) {
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
