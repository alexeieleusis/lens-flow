import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { walkNodes } from "../utils/ast-helpers.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("usecases/UC01-invalid-states.md");

const VALIDATION_NAME_RE = /^(is|validate|check)[A-Z]/;

type FunctionNode =
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression
  | TSESTree.ArrowFunctionExpression;

function isBooleanReturn(node: FunctionNode): boolean {
  return node.returnType?.typeAnnotation.type === "TSBooleanKeyword";
}

function getName(node: FunctionNode): string | null {
  if (node.type === "FunctionDeclaration" && node.id) return node.id.name;
  if (node.type === "FunctionExpression" && node.id) return node.id.name;
  if (node.parent?.type === "Property") {
    if (node.parent.key.type === "Identifier") {
      return node.parent.key.name;
    }
    if (
      node.parent.key.type === "Literal" &&
      typeof node.parent.key.value === "string"
    ) {
      return node.parent.key.value;
    }
  }
  if (
    node.type === "ArrowFunctionExpression" &&
    node.parent?.type === "VariableDeclarator" &&
    node.parent.id.type === "Identifier"
  ) {
    return node.parent.id.name;
  }
  return null;
}

function hasValidationLogic(body: TSESTree.Node): boolean {
  return walkNodes(body, (node) => {
    if (node.type === "CallExpression") {
      const callee = node.callee;
      if (
        callee.type === "MemberExpression" &&
        callee.property.type === "Identifier" &&
        callee.property.name === "test"
      ) {
        return true;
      }
    }
    if (node.type === "BinaryExpression") {
      const leftIsTypeof =
        node.left.type === "UnaryExpression" &&
        (node.left as TSESTree.UnaryExpression).operator === "typeof";
      const rightIsTypeof =
        node.right.type === "UnaryExpression" &&
        (node.right as TSESTree.UnaryExpression).operator === "typeof";
      if (leftIsTypeof || rightIsTypeof) return true;
    }
    return false;
  });
}

export default createRule({
  name: "prefer-parse-over-boolean-validate",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer parser functions that return a refined type over boolean validators that lose type information",
    },
    messages: {
      preferParse:
        "Function '{{name}}' returns boolean and contains validation logic. Consider returning a refined type or null instead, so the caller holds typed evidence of validity. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"preferParse", []>) {
    function checkFunction(node: FunctionNode) {
      if (!isBooleanReturn(node)) return;

      const name = getName(node);
      if (name === null || !VALIDATION_NAME_RE.test(name)) return;

      const body = node.body;
      if (body.type !== "BlockStatement") return;

      if (!hasValidationLogic(body)) return;

      context.report({
        node,
        messageId: "preferParse",
        data: { name, url: URL },
      });
    }

    return {
      FunctionDeclaration(node) {
        checkFunction(node);
      },
      FunctionExpression(node) {
        checkFunction(node);
      },
      ArrowFunctionExpression(node) {
        checkFunction(node);
      },
    };
  },
});
