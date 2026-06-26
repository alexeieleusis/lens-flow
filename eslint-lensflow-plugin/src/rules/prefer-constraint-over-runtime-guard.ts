import { createRule } from "../utils/rule-creator.js";
import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { walk } from "../utils/ast-helpers.js";

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
        "Parameter '{{param}}' is typed as `any` with a runtime guard. Use a generic constraint instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC04-generic-constraints.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"preferConstraint", []>) {
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

      for (const param of node.params) {
        const id = normalizeParam(param);
        if (id && id.typeAnnotation?.typeAnnotation.type === "TSAnyKeyword") {
          const scopeManager = context.sourceCode.scopeManager;
          if (scopeManager) {
            for (const variable of scopeManager.getDeclaredVariables(node)) {
              if (variable.identifiers.includes(id)) {
                anyParamBindings.add(variable);
                break;
              }
            }
          }
        }
      }

      if (anyParamBindings.size === 0) return;

      const body = node.body;
      if (!body) return;

      let hasRuntimeGuard = false;
      let hasPropertyAccess = false;

      const bothFound = () => hasRuntimeGuard && hasPropertyAccess;

      walk(body, (n) => {
        if (bothFound()) return;

        if (n.type === "UnaryExpression" && n.operator === "typeof") {
          if (n.argument.type === "Identifier") {
            for (const binding of anyParamBindings) {
              if (isSameVariable(n.argument, binding)) {
                hasRuntimeGuard = true;
                break;
              }
            }
          }
        }

        if (n.type === "BinaryExpression" && n.operator === "instanceof") {
          if (n.left.type === "Identifier") {
            for (const binding of anyParamBindings) {
              if (isSameVariable(n.left, binding)) {
                hasRuntimeGuard = true;
                break;
              }
            }
          }
        }

        if (n.type === "MemberExpression") {
          if (n.object.type === "Identifier") {
            for (const binding of anyParamBindings) {
              if (isSameVariable(n.object, binding)) {
                hasPropertyAccess = true;
                break;
              }
            }
          }
        }
      });

      if (hasRuntimeGuard && hasPropertyAccess) {
        const paramName = Array.from(anyParamBindings)[0].name;
        context.report({
          node,
          messageId: "preferConstraint",
          data: { param: paramName },
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
