// eslint-plugin/src/rules/no-throw-in-result-function.ts
import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { hasThrow, walkNodes } from "../utils/ast-helpers.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("usecases/UC08-error-handling.md");

const RESULT_TYPES = new Set(["Result", "Either", "TaskEither"]);

function hasResultReturnType(node: TSESTree.FunctionLike): boolean {
  const returnType = node.returnType?.typeAnnotation;
  if (!returnType) return false;

  if (returnType.type === "TSTypeReference") {
    const typeName = returnType.typeName;
    if (typeName.type === "Identifier") {
      return RESULT_TYPES.has(typeName.name);
    }
    if (typeName.type === "TSQualifiedName") {
      return RESULT_TYPES.has(typeName.right.name);
    }
  }

  if (returnType.type === "TSUnionType") {
    return returnType.types.some((t) => {
      if (t.type === "TSTypeReference" && t.typeName.type === "Identifier") {
        return RESULT_TYPES.has(t.typeName.name);
      }
      return false;
    });
  }

  return false;
}

function findFirstThrow(body: TSESTree.Node): TSESTree.ThrowStatement | null {
  let throwNode: TSESTree.ThrowStatement | null = null;
  walkNodes(body, (n) => {
    if (n.type === "ThrowStatement") {
      throwNode = n;
      return true;
    }
    return false;
  });
  return throwNode;
}

const EXCLUDED_NAMES = new Set(["assertNever", "fail"]);

function getFunctionName(
  node: TSESTree.FunctionLike,
): string {
  if (
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression" ||
    node.type === "TSDeclareFunction"
  ) {
    return node.id?.name ?? "";
  }
  return "";
}

function isExcludedFunction(node: TSESTree.FunctionLike): boolean {
  const name = getFunctionName(node);
  return EXCLUDED_NAMES.has(name) || name.startsWith("assert");
}

export default createRule({
  name: "no-throw-in-result-function",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `throw` statements inside functions that return a Result/Either type",
    },
    messages: {
      throwInResultFunction:
        "Function returns a Result/Either type but uses `throw` instead of propagating the error through the Result channel. Return an error variant instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC08-error-handling.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"throwInResultFunction", []>) {
    return {
      FunctionDeclaration(node) {
        if (!hasResultReturnType(node) || isExcludedFunction(node)) return;
        if (!hasThrow(node.body)) return;
        const throwNode = findFirstThrow(node.body);
        if (throwNode) {
          context.report({
            node: throwNode,
            messageId: "throwInResultFunction",
          });
        }
      },

      FunctionExpression(node) {
        if (!hasResultReturnType(node) || isExcludedFunction(node)) return;
        if (!hasThrow(node.body)) return;
        const throwNode = findFirstThrow(node.body);
        if (throwNode) {
          context.report({
            node: throwNode,
            messageId: "throwInResultFunction",
          });
        }
      },

      ArrowFunctionExpression(node) {
        if (!hasResultReturnType(node)) return;
        if (node.body.type !== "BlockStatement") return;
        if (!hasThrow(node.body)) return;
        const throwNode = findFirstThrow(node.body);
        if (throwNode) {
          context.report({
            node: throwNode,
            messageId: "throwInResultFunction",
          });
        }
      },

      MethodDefinition(node) {
        const func = node.value;
        if (func.type !== "FunctionExpression") return;
        if (!hasResultReturnType(func)) return;
        if (isExcludedFunction(func)) return;
        if (func.body.type !== "BlockStatement") return;
        if (!hasThrow(func.body)) return;
        const throwNode = findFirstThrow(func.body);
        if (throwNode) {
          context.report({
            node: throwNode,
            messageId: "throwInResultFunction",
          });
        }
      },

      TSAbstractMethodDefinition(_node) {
        // Abstract methods have TSEmptyBodyFunctionExpression as value — no body to check
        return;
      },
    };
  },
});
