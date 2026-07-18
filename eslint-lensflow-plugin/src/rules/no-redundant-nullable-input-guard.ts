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

const TS_WRAPPER_TYPES = new Set([
  "TSNonNullExpression",
  "TSAsExpression",
  "TSSatisfiesExpression",
  "TSTypeAssertion",
]);

function isTSWrapperType(node: TSESTree.Node): node is TSESTree.Node & { expression: TSESTree.Node } {
  return TS_WRAPPER_TYPES.has(node.type);
}

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

function pushNodeArrayChildren(value: unknown[], children: TSESTree.Node[]): void {
  for (const item of value) {
    if (item && typeof item === "object" && "type" in item)
      children.push(item as TSESTree.Node);
  }
}

function collectChildNodes(node: TSESTree.Node): TSESTree.Node[] {
  const children: TSESTree.Node[] = [];
  const skipProps = new Set(["loc", "range", "parent", "start", "end"]);
  for (const [key, value] of Object.entries(node as unknown as Record<string, unknown>)) {
    if (skipProps.has(key) || !value || typeof value !== "object") continue;
    if ("type" in value) {
      if (Array.isArray(value)) {
        pushNodeArrayChildren(value, children);
      } else {
        children.push(value as TSESTree.Node);
      }
    }
  }
  return children;
}

function hasNestedFunction(node: TSESTree.Node): boolean {
  if (node.type === "ArrowFunctionExpression" || node.type === "FunctionExpression")
    return true;
  return collectChildNodes(node).some(hasNestedFunction);
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
    } else if (isTSWrapperType(node)) {
      walk(node.expression);
    } else if (node.type === "Identifier" && node.name === paramName) {
      parts.push("param");
    }
  }

  walk(test);

  return parts.length > 0 ? parts.join("+") : null;
}

const NESTING_LIMIT = 10;

function extractStatements(node: TSESTree.Statement): TSESTree.Statement[] {
  if (node.type === "BlockStatement") return node.body;
  return [node];
}

function walkStatements(
  stmts: TSESTree.Statement[],
  depth: number,
  paramName: string,
): string | null {
  if (depth > NESTING_LIMIT) return null;

  for (const stmt of stmts.slice(0, 10)) {
    if (hasNestedFunction(stmt)) continue;
    if (stmt.type === "IfStatement") {
      const result = walkIfStatement(stmt, paramName, depth);
      if (result) return result;
    } else {
      const result = walkChildStatements(stmt, paramName, depth);
      if (result) return result;
    }
  }

  return null;
}

function walkIfStatement(
  stmt: TSESTree.IfStatement,
  paramName: string,
  depth: number,
): string | null {
  const pattern = normalizeGuardPattern(stmt.test, paramName);
  if (pattern) return pattern;
  if (stmt.consequent) {
    const nested = walkStatements(extractStatements(stmt.consequent), depth + 1, paramName);
    if (nested) return nested;
  }
  if (stmt.alternate) {
    const nested = walkStatements(extractStatements(stmt.alternate), depth + 1, paramName);
    if (nested) return nested;
  }
  return null;
}

function walkChildStatements(
  stmt: TSESTree.Statement,
  paramName: string,
  depth: number,
): string | null {
  const children = getChildStatements(stmt);
  for (const child of children) {
    const nested = walkStatements(extractStatements(child), depth + 1, paramName);
    if (nested) return nested;
  }
  return null;
}

const SIMPLE_BODY_TYPES = new Set([
  "ForStatement",
  "ForInStatement",
  "ForOfStatement",
  "WhileStatement",
  "DoWhileStatement",
  "WithStatement",
  "LabeledStatement",
]);

function hasBody(stmt: TSESTree.Statement): stmt is TSESTree.Statement & { body: TSESTree.Statement } {
  return SIMPLE_BODY_TYPES.has(stmt.type) && (stmt as unknown as { body?: unknown }).body !== undefined;
}

function getSwitchStatements(stmt: TSESTree.SwitchStatement): TSESTree.Statement[] {
  const result: TSESTree.Statement[] = [];
  for (const caseClause of stmt.cases) {
    if (caseClause.consequent) {
      result.push(...caseClause.consequent);
    }
  }
  return result;
}

function getTryStatements(stmt: TSESTree.TryStatement): TSESTree.Statement[] {
  const result: TSESTree.Statement[] = [];
  if (stmt.block?.body) result.push(...stmt.block.body);
  if (stmt.handler?.body?.body) result.push(...stmt.handler.body.body);
  if (stmt.finalizer?.body) result.push(...stmt.finalizer.body);
  return result;
}

function getChildStatements(stmt: TSESTree.Statement): TSESTree.Statement[] {
  if (hasBody(stmt)) {
    return [stmt.body];
  }

  if (stmt.type === "SwitchStatement" && stmt.cases) {
    return getSwitchStatements(stmt);
  }

  if (stmt.type === "TryStatement") {
    return getTryStatements(stmt);
  }

  return [];
}

function findGuardInBody(body: TSESTree.BlockStatement, paramName: string): string | null {
  if (!body?.body) return null;
  return walkStatements(body.body, 0, paramName);
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
