import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { walkNodes } from "../utils/ast-helpers.js";

const BrandedTypePattern = /^[A-Z]/;

function getBrandName(typeName: TSESTree.Identifier | TSESTree.TSQualifiedName | TSESTree.ThisExpression): string | null {
  if (typeName.type === "Identifier") return typeName.name;
  if (typeName.type === "TSQualifiedName") return typeName.right.name;
  return null;
}

function isBrandedTypeName(node: TSESTree.TSTypeReference): boolean {
  const name = getBrandName(node.typeName);
  return name !== null && BrandedTypePattern.test(name);
}

function hasBrandedReturnType(
  returnType: TSESTree.TypeNode | null,
): string | null {
  if (!returnType) return null;

  function walkType(n: TSESTree.TypeNode): string | null {
    if (n.type === "TSTypeReference" && isBrandedTypeName(n)) {
      return getBrandName(n.typeName);
    }
    if (n.type === "TSUnionType") {
      for (const member of n.types) {
        const found = walkType(member);
        if (found) return found;
      }
    }
    if (n.type === "TSNullKeyword" || n.type === "TSUndefinedKeyword") {
      // allow `| null` / `| undefined` return — still check body
    }
    return null;
  }

  return walkType(returnType);
}

function isBrandedCast(node: TSESTree.Node): string | null {
  if (node.type !== "TSAsExpression") return null;
  const t = node.typeAnnotation;
  if (t.type !== "TSTypeReference" || !isBrandedTypeName(t)) return null;
  const name = getBrandName(t.typeName);
  return name ?? null;
}

function nextCursor(node: TSESTree.Node): TSESTree.Node | null {
  if ("consequent" in node && node.type === "IfStatement") {
    return node.consequent;
  }
  if ("body" in node) {
    const child = (node as { body?: TSESTree.Node }).body;
    if (child && node.type !== "BlockStatement") {
      return child;
    }
  }
  return null;
}

function hasBrandedCastInBody(
  body: TSESTree.Node,
): string | null {
  let cursor: TSESTree.Node | null = body;

  while (cursor) {
    const brand = isBrandedCast(cursor);
    if (brand) return brand;

    const next = nextCursor(cursor);
    if (next) {
      cursor = next;
      continue;
    }
    break;
  }

  return null;
}

function hasValidationLogic(node: TSESTree.Node): boolean {
  return walkNodes(node, (current) => {
    if (
      current.type === "IfStatement" ||
      current.type === "ConditionalExpression"
    ) {
      return true;
    }

    if (current.type === "LogicalExpression") {
      return true;
    }

    if (
      current.type === "BinaryExpression" &&
      [">", "<", ">=", "<=", "===", "!==", "in", "instanceof"].includes(
        current.operator as string,
      )
    ) {
      return true;
    }

    if (current.type === "CallExpression") {
      return true;
    }

    return false;
  });
}

function isOnlyReturnWithCast(
  body: TSESTree.BlockStatement,
): boolean {
  if (body.body.length !== 1) return false;
  const stmt = body.body[0];
  if (stmt.type !== "ReturnStatement") return false;
  if (!stmt.argument) return false;
  if (stmt.argument.type === "TSAsExpression") return true;
  return false;
}

function isArrowBareCast(
  body: TSESTree.Node,
): boolean {
  return body.type === "TSAsExpression";
}

export default createRule({
  name: "require-smart-constructor-validation",
  meta: {
    type: "problem",
    docs: {
      description:
        "Enforce that smart constructors validate inputs before casting to a branded type",
    },
    messages: {
      noValidation:
        "Smart constructor casts to {{brand}} without any validation logic. Add input validation before the cast. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/usecases/UC09-builder-config.md",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"noValidation", []>) {
    function checkFunction(
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression,
    ) {
      const branded = hasBrandedReturnType(node.returnType?.typeAnnotation ?? null) || hasBrandedCastInBody(node.body);
      if (!branded) return;

      const isArrowBareCastCheck =
        node.type === "ArrowFunctionExpression" && isArrowBareCast(node.body);
      const isOnlyReturnCastCheck =
        node.body.type === "BlockStatement" && isOnlyReturnWithCast(node.body);

      if (isArrowBareCastCheck || isOnlyReturnCastCheck) {
        if (!hasValidationLogic(node)) {
          context.report({
            node,
            messageId: "noValidation",
            data: { brand: branded },
          });
        }
      }
    }

    return {
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction,
    };
  },
});
