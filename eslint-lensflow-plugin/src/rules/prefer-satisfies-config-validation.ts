import { AST_NODE_TYPES, TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { walk, walkNodes } from "../utils/ast-helpers.js";

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
    if (elem?.type === AST_NODE_TYPES.Identifier) return elem.name;
    return null;
  }
  return null;
}

function normalizeParam(
  param: TSESTree.Parameter,
): { node: TSESTree.Node; name: string } | null {
  let inner: TSESTree.Node = param;
  const typeAnn: TSESTree.TSTypeAnnotation | undefined | null =
    "typeAnnotation" in param ? param.typeAnnotation : null;
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
    const resolvedAnn = typeAnn ?? inner.typeAnnotation;
    if (
      resolvedAnn != null &&
      resolvedAnn.typeAnnotation?.type === AST_NODE_TYPES.TSAnyKeyword
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

function checkContainsParamMemberExpression(
  node: TSESTree.Node,
  paramName: string,
): boolean {
  return walkNodes(node, (n) => {
    if (
      n.type === AST_NODE_TYPES.MemberExpression &&
      n.object.type === AST_NODE_TYPES.Identifier &&
      n.object.name === paramName
    ) {
      return true;
    }
    return false;
  });
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

function countRuntimeChecks(
  body: TSESTree.Node,
  paramName: string,
): number {
  const seenMemberExprs = new Set<TSESTree.Node>();
  let arrayCallChecks = 0;
  let hasComputedAccess = 0;

  walk(body, (node) => {
    if (node.type === AST_NODE_TYPES.CallExpression) {
      if (checkArrayMethodCallOnParam(node, paramName)) {
        arrayCallChecks++;
      }
    } else if (node.type === AST_NODE_TYPES.MemberExpression) {
      if (
        node.object.type === AST_NODE_TYPES.Identifier &&
        node.object.name === paramName
      ) {
        if (!seenMemberExprs.has(node)) {
          seenMemberExprs.add(node);
          if (node.computed) {
            hasComputedAccess = 1;
          }
        }
      }
    }
  });

  return seenMemberExprs.size + arrayCallChecks + hasComputedAccess;
}

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
