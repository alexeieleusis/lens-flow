// eslint-plugin/src/rules/no-throw-in-result-function.ts
import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { walkNodes } from "../utils/ast-helpers.js";

function hasResultReturnType(node: TSESTree.FunctionLike): boolean {
  const returnType = node.returnType?.typeAnnotation;
  if (!returnType) return false;

  if (returnType.type === "TSTypeReference") {
    const typeName = returnType.typeName;
    if (typeName.type === "Identifier") {
      return /Result|Either|TaskEither/.test(typeName.name);
    }
    if (typeName.type === "TSQualifiedName") {
      const leftName =
        typeName.left.type === "Identifier" ? typeName.left.name : "";
      const fullName = `${leftName}.${typeName.right.name}`;
      return /Result|Either|TaskEither/.test(fullName);
    }
  }

  if (returnType.type === "TSUnionType") {
    return returnType.types.some((t) => {
      if (t.type === "TSTypeReference" && t.typeName.type === "Identifier") {
        return /Result|Either|TaskEither/.test(t.typeName.name);
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
        "Function returns a Result/Either type but uses `throw` instead of propagating the error through the Result channel. Return an error variant instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/usecases/UC08-error-handling.md",
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
