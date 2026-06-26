import { AST_NODE_TYPES, TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

function getNameFromPattern(pattern: TSESTree.Node): string | null {
  if (pattern.type === AST_NODE_TYPES.Identifier) return pattern.name;
  if (pattern.type === AST_NODE_TYPES.ObjectPattern) {
    const prop = pattern.properties[0];
    if (prop && "key" in prop && prop.key.type === AST_NODE_TYPES.Identifier) {
      return prop.key.name;
    }
    return null;
  }
  if (pattern.type === AST_NODE_TYPES.ArrayPattern) {
    const elem = pattern.elements[0];
    if (elem && elem.type === AST_NODE_TYPES.Identifier) return elem.name;
    return null;
  }
  return null;
}

function normalizeParam(
  param: TSESTree.Parameter,
): { node: TSESTree.Node; name: string } | null {
  let inner: TSESTree.Node = param;
  if (param.type === AST_NODE_TYPES.AssignmentPattern) {
    inner = param.left;
  } else if (param.type === AST_NODE_TYPES.RestElement) {
    inner = param.argument;
  }

  if (
    inner.type === AST_NODE_TYPES.Identifier ||
    inner.type === AST_NODE_TYPES.ObjectPattern ||
    inner.type === AST_NODE_TYPES.ArrayPattern
  ) {
    if (
      inner.typeAnnotation != null &&
      inner.typeAnnotation.typeAnnotation?.type === AST_NODE_TYPES.TSAnyKeyword
    ) {
      const name = getNameFromPattern(inner);
      if (name) return { node: inner, name };
    }
  }
  return null;
}

function findAnyParam(
  params: TSESTree.Parameter[],
): { node: TSESTree.Node; name: string } | null {
  for (const param of params) {
    const result = normalizeParam(param);
    if (result) return result;
  }
  return null;
}

function isNode(val: unknown): val is TSESTree.Node {
  return val != null && typeof val === "object" && "type" in val;
}

// Keys that are not AST child nodes — skip to avoid circular traversal.
const NON_CHILD_KEYS = new Set(["parent", "loc", "range", "start", "end"]);

function childNodesMatch(
  node: TSESTree.Node,
  paramName: string,
): boolean {
  for (const key of Object.keys(node) as (keyof TSESTree.Node)[]) {
    if (NON_CHILD_KEYS.has(key)) continue;
    const child = (node as unknown as Record<string, unknown>)[key];
    if (Array.isArray(child)) {
      if (arrayContainsMatchingNode(child, paramName)) return true;
    }
    if (isNode(child) && checkContainsParamMemberExpression(child, paramName)) {
      return true;
    }
  }
  return false;
}

function arrayContainsMatchingNode(arr: unknown[], paramName: string): boolean {
  for (const item of arr) {
    if (isNode(item) && checkContainsParamMemberExpression(item, paramName)) {
      return true;
    }
  }
  return false;
}

function checkContainsParamMemberExpression(
  node: TSESTree.Node,
  paramName: string,
): boolean {
  if (node.type === AST_NODE_TYPES.MemberExpression) {
    const obj = node.object;
    if (obj.type === AST_NODE_TYPES.Identifier && obj.name === paramName) {
      return true;
    }
    return (
      checkContainsParamMemberExpression(node.object, paramName) ||
      checkContainsParamMemberExpression(node.property, paramName)
    );
  }
  return childNodesMatch(node, paramName);
}

function checkArrayMethodCallOnParam(
  call: TSESTree.CallExpression,
  paramName: string,
): boolean {
  if (
    call.callee.type === AST_NODE_TYPES.MemberExpression &&
    call.callee.object.type === AST_NODE_TYPES.ArrayExpression
  ) {
    const methodName =
      call.callee.property.type === AST_NODE_TYPES.Identifier
        ? call.callee.property.name
        : null;
    if (methodName === "includes" || methodName === "indexOf") {
      for (const arg of call.arguments) {
        if (
          arg.type === AST_NODE_TYPES.MemberExpression &&
          arg.object.type === AST_NODE_TYPES.Identifier &&
          arg.object.name === paramName
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

function walkNodeBody(body: unknown, walk: (node: TSESTree.Node) => void) {
  if (Array.isArray(body)) {
    for (const stmt of body) {
      walk(stmt);
    }
  } else if (body && typeof body === "object" && "type" in body) {
    walk(body as TSESTree.Node);
  }
}

function countRuntimeChecks(
  body: TSESTree.Node,
  paramName: string,
): number {
  let count = 0;

  function walkIfStatement(node: TSESTree.IfStatement) {
    if (checkContainsParamMemberExpression(node.test, paramName)) {
      count++;
    }
    walk(node.consequent);
    if (node.alternate) {
      walk(node.alternate);
    }
  }

  function walkCallExpression(node: TSESTree.CallExpression) {
    if (checkArrayMethodCallOnParam(node, paramName)) {
      count++;
    }
    for (const arg of node.arguments) {
      walk(arg);
    }
    if (node.callee.type === AST_NODE_TYPES.MemberExpression) {
      walk(node.callee.object);
      walk(node.callee.property);
    }
  }

  function walk(node: TSESTree.Node) {
    if (FUNCTION_TYPES.includes(node.type as any)) return;
    if (node.type === AST_NODE_TYPES.IfStatement) {
      walkIfStatement(node);
    } else if (node.type === AST_NODE_TYPES.CallExpression) {
      walkCallExpression(node);
    } else {
      if ("body" in node && node.body) {
        walkNodeBody(node.body, walk);
      }
      if ("consequent" in node) {
        walkNodeBody(node.consequent, walk);
      }
      if ("alternate" in node) {
        walkNodeBody(node.alternate, walk);
      }
    }
  }

  walkNodeBody(body, walk);

  return count;
}

const FUNCTION_TYPES = [
  AST_NODE_TYPES.FunctionDeclaration,
  AST_NODE_TYPES.FunctionExpression,
  AST_NODE_TYPES.ArrowFunctionExpression,
  AST_NODE_TYPES.TSDeclareFunction,
  AST_NODE_TYPES.TSFunctionType,
  AST_NODE_TYPES.TSMethodSignature,
] as const;

export default createRule({
  name: "prefer-satisfies-config-validation",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer `satisfies` for compile-time config shape validation over runtime checks on `any`-typed parameters",
    },
    messages: {
      preferSatisfies:
        "Found {{count}} runtime property checks on `any`-typed parameter '{{paramName}}'. Use the `satisfies` operator for compile-time shape validation instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC09-builder-config.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"preferSatisfies", []>) {
    function checkFunction(node: TSESTree.FunctionLike) {
      const anyParam = findAnyParam(node.params);
      if (!anyParam) return;

      const body = node.body;
      if (!body) return;

      const checks = countRuntimeChecks(body, anyParam.name);
      if (checks >= 2) {
        context.report({
          node: anyParam.node,
          messageId: "preferSatisfies",
          data: {
            count: String(checks),
            paramName: anyParam.name,
          },
        });
      }
    }

    function checkFunctionSignature(
      node: TSESTree.TSFunctionType | TSESTree.TSMethodSignature,
    ) {
      const anyParam = findAnyParam(node.params);
      if (!anyParam) return;

      const body = (node as unknown as { body?: TSESTree.Node })?.body;
      if (!body) return;

      const checks = countRuntimeChecks(body, anyParam.name);
      if (checks >= 2) {
        context.report({
          node: anyParam.node,
          messageId: "preferSatisfies",
          data: {
            count: String(checks),
            paramName: anyParam.name,
          },
        });
      }
    }

    return {
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction,
      MethodDefinition: (node: TSESTree.MethodDefinition) => {
        checkFunction(node.value);
      },
      TSDeclareFunction: checkFunction,
      TSFunctionType: checkFunctionSignature,
      TSMethodSignature: checkFunctionSignature,
    };
  },
});
