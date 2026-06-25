import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

const KNOWLEDGE_URL =
  "https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T26-refinement-types.md";

const PRIMITIVE_KEYWORDS = new Set([
  "TSStringKeyword",
  "TSNumberKeyword",
  "TSBooleanKeyword",
  "TSSymbolKeyword",
]);

const NULLISH_KEYWORDS = new Set(["TSNullKeyword", "TSUndefinedKeyword"]);

function getNullableTypeSignature(typeAnn: any): string | null {
  if (typeAnn.type !== "TSUnionType") return null;

  let hasNullish = false;
  let primitiveType = "";

  for (const member of typeAnn.types) {
    if (NULLISH_KEYWORDS.has(member.type)) {
      hasNullish = true;
    } else if (PRIMITIVE_KEYWORDS.has(member.type)) {
      primitiveType = member.type;
    }
  }

  if (!hasNullish || !primitiveType) return null;

  if (primitiveType === "TSStringKeyword") return "string-nullable";
  if (primitiveType === "TSNumberKeyword") return "number-nullable";
  if (primitiveType === "TSBooleanKeyword") return "boolean-nullable";
  return "other-nullable";
}

function referencesParam(expr: any, paramName: string): boolean {
  if (!expr) return false;
  if (expr.type === "Identifier") return expr.name === paramName;
  if (expr.type === "MemberExpression")
    return referencesParam(expr.object, paramName);
  if (expr.type === "UnaryExpression") return referencesParam(expr.argument, paramName);
  if (expr.type === "BinaryExpression")
    return referencesParam(expr.left, paramName) || referencesParam(expr.right, paramName);
  if (expr.type === "LogicalExpression")
    return referencesParam(expr.left, paramName) || referencesParam(expr.right, paramName);
  return false;
}

function normalizeGuardPattern(test: any, paramName: string): string | null {
  if (!referencesParam(test, paramName)) return null;

  const parts: string[] = [];
  const visited = new Set<any>();

  function isNegatedParamIdentifier(node: any): boolean {
    return (
      node.argument.type === "Identifier" &&
      node.argument.name === paramName
    );
  }

  function isParamMemberExpression(node: any): boolean {
    return (
      node.object.type === "Identifier" &&
      node.object.name === paramName &&
      node.property.type === "Identifier"
    );
  }

  function walk(node: any) {
    if (!node || visited.has(node)) return;
    visited.add(node);

    if (node.type === "UnaryExpression" && node.operator === "!") {
      if (isNegatedParamIdentifier(node)) {
        parts.push("!param");
        return;
      }
      walk(node.argument);
    } else if (node.type === "MemberExpression" && !node.computed) {
      if (isParamMemberExpression(node)) {
        parts.push(`param.${node.property.name}`);
      } else {
        walk(node.object);
        walk(node.property);
      }
    } else if (node.type === "BinaryExpression" || node.type === "LogicalExpression") {
      walk(node.left);
      walk(node.right);
    } else if (node.type === "Identifier" && node.name === paramName) {
      parts.push("param");
    }
  }

  walk(test);

  return parts.length > 0 ? parts.join("+") : null;
}

function findGuardInBody(body: any, paramName: string): string | null {
  if (!body?.body) return null;

  const NESTING_LIMIT = 10;

  function walkStatements(stmts: any[], depth: number): string | null {
    if (depth > NESTING_LIMIT) return null;

    for (const stmt of stmts.slice(0, 10)) {
      if (stmt.type === "IfStatement") {
        const pattern = normalizeGuardPattern(stmt.test, paramName);
        if (pattern) return pattern;
        if (stmt.consequent) {
          const nested = walkStatements(
            Array.isArray(stmt.consequent.body) ? stmt.consequent.body : [stmt.consequent],
            depth + 1,
          );
          if (nested) return nested;
        }
        if (stmt.alternate) {
          const nested = walkStatements(
            Array.isArray(stmt.alternate.body) ? stmt.alternate.body : [stmt.alternate],
            depth + 1,
          );
          if (nested) return nested;
        }
      }

      if (stmt.type === "ForStatement" || stmt.type === "ForInStatement" || stmt.type === "ForOfStatement") {
        if (stmt.body) {
          const nested = walkStatements(
            Array.isArray(stmt.body.body) ? stmt.body.body : [stmt.body],
            depth + 1,
          );
          if (nested) return nested;
        }
      }

      if (stmt.type === "WhileStatement" || stmt.type === "DoWhileStatement") {
        if (stmt.body) {
          const nested = walkStatements(
            Array.isArray(stmt.body.body) ? stmt.body.body : [stmt.body],
            depth + 1,
          );
          if (nested) return nested;
        }
      }

      if (stmt.type === "WithStatement") {
        const nested = walkStatements(
          Array.isArray(stmt.body.body) ? stmt.body.body : [stmt.body],
          depth + 1,
        );
        if (nested) return nested;
      }

      if (stmt.type === "TryStatement") {
        if (stmt.block?.body) {
          const nested = walkStatements(stmt.block.body, depth + 1);
          if (nested) return nested;
        }
        if (stmt.handler?.handler?.body?.body) {
          const nested = walkStatements(stmt.handler.handler.body.body, depth + 1);
          if (nested) return nested;
        }
        if (stmt.finalizer?.body) {
          const nested = walkStatements(
            Array.isArray(stmt.finalizer.body) ? stmt.finalizer.body : [stmt.finalizer],
            depth + 1,
          );
          if (nested) return nested;
        }
      }

      if (stmt.type === "LabeledStatement" && stmt.body) {
        const nested = walkStatements(
          Array.isArray(stmt.body.body) ? stmt.body.body : [stmt.body],
          depth + 1,
        );
        if (nested) return nested;
      }

      if (stmt.type === "SwitchStatement" && stmt.cases) {
        for (const caseClause of stmt.cases || []) {
          if (caseClause.consequent) {
            const nested = walkStatements(caseClause.consequent, depth + 1);
            if (nested) return nested;
          }
        }
      }
    }

    return null;
  }

  const statements = Array.isArray(body.body) ? body.body : [body.body];
  return walkStatements(statements, 0);
}

interface FuncInfo {
  paramNode: any;
  paramName: string;
  typeSig: string;
  guardPattern: string;
  signature: string;
}

export default createRule({
  name: "no-redundant-nullable-input-guard",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow multiple functions from repeating the same null guard on a nullable union parameter instead of using a branded non-null type produced once upstream",
    },
    messages: {
      redundantGuard:
        "Multiple functions ({{count}}) repeat the same null guard for {{param}}:{{typeSig}}. Use a branded non-null type with a single upstream parser instead. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"redundantGuard", []>) {
    const functions: FuncInfo[] = [];

    function visitFunction(node: any) {
      if (!node.params || !node.body) return;

      for (const param of node.params) {
        // param is an Identifier node: param.name is the string, param.typeAnnotation is TSTypeAnnotation
        const paramName = typeof param.name === "string" ? param.name : null;
        if (!paramName) continue;

        if (!param.typeAnnotation) continue;

        const typeAnn = param.typeAnnotation.typeAnnotation;
        const typeSig = getNullableTypeSignature(typeAnn);
        if (!typeSig) continue;

        const guardPattern = findGuardInBody(node.body, paramName);
        if (!guardPattern) continue;

        const signature = `${typeSig}:${guardPattern}`;

        functions.push({
          paramNode: param,
          paramName,
          typeSig,
          guardPattern,
          signature,
        });
      }
    }

    return {
      FunctionDeclaration(node) {
        visitFunction(node);
      },
      FunctionExpression(node) {
        visitFunction(node);
      },
      ArrowFunctionExpression(node) {
        visitFunction(node);
      },
      "Program:exit"() {
        const groups = new Map<string, FuncInfo[]>();
        for (const fn of functions) {
          const existing = groups.get(fn.signature) || [];
          existing.push(fn);
          groups.set(fn.signature, existing);
        }

        for (const [, group] of groups) {
          if (group.length < 2) continue;

          for (const fn of group) {
            context.report({
              node: fn.paramNode,
              messageId: "redundantGuard",
              data: {
                count: String(group.length),
                param: fn.paramName,
                typeSig: fn.typeSig,
                url: KNOWLEDGE_URL,
              },
            });
          }
        }
      },
    };
  },
});
