import { createRule } from "../utils/rule-creator.js";
import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { walk } from "../utils/ast-helpers.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("usecases/UC04-generic-constraints.md");

function normalizeParam(
  param: TSESTree.Parameter,
): TSESTree.Identifier | null {
  if (param.type === "TSParameterProperty") {
    return normalizeParam(param.parameter);
  }
  if (param.type === "AssignmentPattern") {
    const left = param.left as TSESTree.Identifier | TSESTree.ArrayPattern | TSESTree.ObjectPattern;
    if (left.type === "Identifier") return left;
    return null;
  }
  if (param.type === "RestElement") {
    const arg = param.argument as TSESTree.Identifier | TSESTree.ArrayPattern | TSESTree.ObjectPattern;
    if (arg.type === "Identifier") return arg;
    return null;
  }
  if (param.type === "Identifier") {
    return param;
  }
  return null;
}

function findAnyParamVariable(
  param: TSESTree.Parameter,
  scopeManager: TSESLint.Scope.ScopeManager,
  node:
    | TSESTree.FunctionDeclaration
    | TSESTree.FunctionExpression
    | TSESTree.ArrowFunctionExpression,
): TSESLint.Scope.Variable | null {
  const id = normalizeParam(param);
  if (!id || id.typeAnnotation?.typeAnnotation.type !== "TSAnyKeyword") {
    return null;
  }
  return scopeManager
    .getDeclaredVariables(node)
    .find((v) => v.identifiers.includes(id)) ?? null;
}

export default createRule({
  name: "prefer-constraint-over-runtime-guard",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer generic constraints over runtime typeof/instanceof guards on `any` parameters",
    },
    messages: {
      preferConstraint:
        "Parameter '{{param}}' is typed as `any` with a runtime guard. Use a generic constraint instead. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"preferConstraint", []>) {
    function isSameVariable(
      ident: TSESTree.Identifier,
      target: TSESLint.Scope.Variable,
    ): boolean {
      let current: TSESLint.Scope.Scope | null = context.sourceCode.getScope(ident);
      while (current) {
        for (const v of current.variables) {
          if (v.name === ident.name) return v === target;
        }
        current = current.upper;
      }
      return false;
    }

    function checkFunction(
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression,
    ): void {
      const anyParamBindings = new Set<TSESLint.Scope.Variable>();
      const scopeManager = context.sourceCode.scopeManager;

      for (const param of node.params) {
        if (!scopeManager) continue;
        const variable = findAnyParamVariable(param, scopeManager, node);
        if (variable) anyParamBindings.add(variable);
      }

      if (anyParamBindings.size === 0) return;

      const body = node.body;
      if (!body) return;

      let hasRuntimeGuard = false;
      let hasPropertyAccess = false;

      const bothFound = () => hasRuntimeGuard && hasPropertyAccess;

      function isAnyParamIdent(ident: TSESTree.Identifier): boolean {
        for (const binding of anyParamBindings) {
          if (isSameVariable(ident, binding)) return true;
        }
        return false;
      }

      function isRuntimeGuard(n: TSESTree.Node): boolean {
        if (n.type === "UnaryExpression"
          && n.operator === "typeof"
          && n.argument.type === "Identifier"
          && isAnyParamIdent(n.argument)) {
          return true;
        }
        if (n.type === "BinaryExpression"
          && n.operator === "instanceof"
          && n.left.type === "Identifier"
          && isAnyParamIdent(n.left)) {
          return true;
        }
        return false;
      }

      function isPropertyAccess(n: TSESTree.Node): boolean {
        return n.type === "MemberExpression"
          && n.object.type === "Identifier"
          && isAnyParamIdent(n.object);
      }

      walk(body, (n) => {
        if (bothFound()) return;
        if (isRuntimeGuard(n)) {
          hasRuntimeGuard = true;
          return;
        }
        if (isPropertyAccess(n)) {
          hasPropertyAccess = true;
        }
      });

      if (hasRuntimeGuard && hasPropertyAccess) {
        const paramName = Array.from(anyParamBindings)[0].name;
        context.report({
          node,
          messageId: "preferConstraint",
          data: { param: paramName, url: URL },
        });
      }
    }

    return {
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction,
    };
  },
});
