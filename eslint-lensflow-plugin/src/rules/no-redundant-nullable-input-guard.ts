import { createRule } from "../utils/rule-creator.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

function extractParamIdentifier(
  param: TSESTree.Parameter,
): TSESTree.Identifier | null {
  if (param.type === "Identifier") return param;
  if (param.type === "AssignmentPattern") {
    if (param.left.type === "Identifier") return param.left;
    return null;
  }
  if (param.type === "RestElement") {
    if (param.argument.type === "Identifier") return param.argument;
    return null;
  }
  return null;
}

function extractParamTypeAnnotation(
  param: TSESTree.Parameter,
): TSESTree.TSTypeAnnotation | null {
  if (param.type === "Identifier" && param.typeAnnotation) {
    return param.typeAnnotation;
  }
  if (param.type === "AssignmentPattern") {
    if (param.left.type === "Identifier" && param.left.typeAnnotation) {
      return param.left.typeAnnotation;
    }
  }
  if (param.type === "RestElement") {
    if (param.argument.type === "Identifier" && param.argument.typeAnnotation) {
      return param.argument.typeAnnotation;
    }
  }
  return null;
}

const KNOWLEDGE_URL =
  "https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T26-refinement-types.md";

const PRIMITIVE_KEYWORDS = new Set([
  "TSStringKeyword",
  "TSNumberKeyword",
  "TSBooleanKeyword",
  "TSSymbolKeyword",
]);

const NULLISH_KEYWORDS = new Set(["TSNullKeyword", "TSUndefinedKeyword"]);

function getNullableTypeSignature(typeAnn: TSESTree.TypeNode): string | null {
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
  if (primitiveType === "TSSymbolKeyword") return "symbol-nullable";
  return "other-nullable";
}

function hasNestedFunction(node: TSESTree.Node): boolean {
  if (node.type === "ArrowFunctionExpression" || node.type === "FunctionExpression")
    return true;
  const children: TSESTree.Node[] = [];
  const skipProps = new Set(["loc", "range", "parent", "start", "end"]);
  for (const [key, value] of Object.entries(node as unknown as Record<string, unknown>)) {
    if (skipProps.has(key) || !value || typeof value !== "object") continue;
    if ("type" in value) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item && typeof item === "object" && "type" in item)
            children.push(item as TSESTree.Node);
        }
      } else {
        children.push(value as TSESTree.Node);
      }
    }
  }
  return children.some(hasNestedFunction);
}

function referencesParam(expr: TSESTree.Expression | TSESTree.PrivateIdentifier | null | undefined, paramName: string): boolean {
  if (!expr) return false;
  if (expr.type === "Identifier") return expr.name === paramName;
  if (expr.type === "MemberExpression")
    return referencesParam(expr.object, paramName);
  if (expr.type === "UnaryExpression") return referencesParam(expr.argument, paramName);
  if (expr.type === "BinaryExpression")
    return referencesParam(expr.left, paramName) || referencesParam(expr.right, paramName);
  if (expr.type === "LogicalExpression")
    return referencesParam(expr.left, paramName) || referencesParam(expr.right, paramName);
  if (expr.type === "TSNonNullExpression") return referencesParam(expr.expression, paramName);
  if (expr.type === "TSAsExpression") return referencesParam(expr.expression, paramName);
  if (expr.type === "TSSatisfiesExpression") return referencesParam(expr.expression, paramName);
  if (expr.type === "TSTypeAssertion") return referencesParam(expr.expression, paramName);
  return false;
}

function normalizeGuardPattern(test: TSESTree.Expression, paramName: string): string | null {
  if (!referencesParam(test, paramName)) return null;

  const parts: string[] = [];
  const visited = new Set<TSESTree.Node>();

  function isNegatedParamIdentifier(node: TSESTree.UnaryExpression): boolean {
    return (
      node.argument.type === "Identifier" &&
      node.argument.name === paramName
    );
  }

  function isParamMemberExpression(node: TSESTree.MemberExpression): boolean {
    return (
      node.object.type === "Identifier" &&
      node.object.name === paramName &&
      node.property.type === "Identifier"
    );
  }

  function walk(node: TSESTree.Node) {
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
    } else if (node.type === "TSNonNullExpression") {
      walk(node.expression);
    } else if (node.type === "TSAsExpression") {
      walk(node.expression);
    } else if (node.type === "TSSatisfiesExpression") {
      walk(node.expression);
    } else if (node.type === "TSTypeAssertion") {
      walk(node.expression);
    }
  }

  walk(test);

  return parts.length > 0 ? parts.join("+") : null;
}

function findGuardInBody(body: TSESTree.BlockStatement, paramName: string): string | null {
  if (!body?.body) return null;

  const NESTING_LIMIT = 10;

  function extractStatements(node: TSESTree.Statement): TSESTree.Statement[] {
    if (node.type === "BlockStatement") return node.body;
    return [node];
  }

  function walkStatements(stmts: TSESTree.Statement[], depth: number): string | null {
    if (depth > NESTING_LIMIT) return null;

    for (const stmt of stmts.slice(0, 10)) {
      // Skip statements containing nested functions — guards inside belong to different scope
      if (hasNestedFunction(stmt)) continue;

      if (stmt.type === "IfStatement") {
        const pattern = normalizeGuardPattern(stmt.test, paramName);
        if (pattern) return pattern;
        if (stmt.consequent) {
          const nested = walkStatements(extractStatements(stmt.consequent), depth + 1);
          if (nested) return nested;
        }
        if (stmt.alternate) {
          const nested = walkStatements(extractStatements(stmt.alternate), depth + 1);
          if (nested) return nested;
        }
      }

      if (stmt.type === "ForStatement" || stmt.type === "ForInStatement" || stmt.type === "ForOfStatement") {
        if (stmt.body) {
          const nested = walkStatements(extractStatements(stmt.body), depth + 1);
          if (nested) return nested;
        }
      }

      if (stmt.type === "WhileStatement" || stmt.type === "DoWhileStatement") {
        if (stmt.body) {
          const nested = walkStatements(extractStatements(stmt.body), depth + 1);
          if (nested) return nested;
        }
      }

      if (stmt.type === "WithStatement") {
        const nested = walkStatements(extractStatements(stmt.body), depth + 1);
        if (nested) return nested;
      }

      if (stmt.type === "TryStatement") {
        if (stmt.block?.body) {
          const nested = walkStatements(stmt.block.body, depth + 1);
          if (nested) return nested;
        }
        if (stmt.handler?.body?.body) {
          const nested = walkStatements(stmt.handler.body.body, depth + 1);
          if (nested) return nested;
        }
        if (stmt.finalizer?.body) {
          const nested = walkStatements(stmt.finalizer.body, depth + 1);
          if (nested) return nested;
        }
      }

      if (stmt.type === "LabeledStatement" && stmt.body) {
        const nested = walkStatements(extractStatements(stmt.body), depth + 1);
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

  return walkStatements(body.body, 0);
}

interface FuncInfo {
  paramNode: TSESTree.Identifier;
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

    function visitFunction(node: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression) {
      if (!node.params || !node.body) return;
      if (node.body.type !== "BlockStatement") return;

      for (const param of node.params) {
        const identifier = extractParamIdentifier(param);
        if (!identifier) continue;

        const typeAnnNode = extractParamTypeAnnotation(param);
        if (!typeAnnNode) continue;

        const paramName = identifier.name;
        const typeAnn = typeAnnNode.typeAnnotation;
        const typeSig = getNullableTypeSignature(typeAnn);
        if (!typeSig) continue;

        const guardPattern = findGuardInBody(node.body, paramName);
        if (!guardPattern) continue;

        const signature = `${typeSig}:${guardPattern}`;

        functions.push({
          paramNode: identifier,
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
      MethodDefinition(node) {
        if (node.value.type === "FunctionExpression") {
          visitFunction(node.value);
        }
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
