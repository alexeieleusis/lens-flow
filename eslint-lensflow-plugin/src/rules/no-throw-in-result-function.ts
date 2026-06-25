// eslint-plugin/src/rules/no-throw-in-result-function.ts
import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { walkNodes } from "../utils/ast-helpers.js";

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

function findThrowStatement(node: TSESTree.Node): TSESTree.ThrowStatement | null {
  let found: TSESTree.ThrowStatement | null = null;
  walkNodes(node, (n) => {
    if (n.type === "ThrowStatement") {
      found = n;
      return true;
    }
    return false;
  });
  return found;
}

const EXCLUDED_NAMES = new Set(["assertNever", "fail"]);

function isExcludedFunction(node: TSESTree.FunctionLike): boolean {
  const name =
    node.type === "FunctionDeclaration" || node.type === "FunctionExpression"
      ? node.id?.name ?? ""
      : "";

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
        if (findThrowStatement(node.body)) {
          context.report({
            node,
            messageId: "throwInResultFunction",
          });
        }
      },

      FunctionExpression(node) {
        if (!hasResultReturnType(node) || isExcludedFunction(node)) return;
        if (findThrowStatement(node.body)) {
          context.report({
            node,
            messageId: "throwInResultFunction",
          });
        }
      },

      ArrowFunctionExpression(node) {
        if (!hasResultReturnType(node)) return;
        if (findThrowStatement(node.body)) {
          context.report({
            node,
            messageId: "throwInResultFunction",
          });
        }
      },
    };
  },
});
