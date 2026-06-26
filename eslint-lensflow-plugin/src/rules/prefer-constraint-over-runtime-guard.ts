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

    function checkFunction(
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression,
    ): void {
      const anyParamNames = new Set<string>();

      for (const param of node.params) {
        const id = normalizeParam(param);
        if (id && id.typeAnnotation?.typeAnnotation.type === "TSAnyKeyword") {
          anyParamNames.add(id.name);
        }
      }

      if (anyParamNames.size === 0) return;

      const body = node.body;
      if (!body) return;

      let hasRuntimeGuard = false;
      let hasPropertyAccess = false;

      const bothFound = () => hasRuntimeGuard && hasPropertyAccess;

      walk(body, (n) => {
        if (bothFound()) return;

        if (n.type === "UnaryExpression" && n.operator === "typeof") {
          if (
            n.argument.type === "Identifier" &&
            anyParamNames.has(n.argument.name)
          ) {
            hasRuntimeGuard = true;
          }
        }

        if (n.type === "BinaryExpression" && n.operator === "instanceof") {
          if (
            n.left.type === "Identifier" &&
            anyParamNames.has(n.left.name)
          ) {
            hasRuntimeGuard = true;
          }
        }

        if (n.type === "MemberExpression") {
          if (
            n.object.type === "Identifier" &&
            anyParamNames.has(n.object.name)
          ) {
            hasPropertyAccess = true;
          }
        }
      });

      if (hasRuntimeGuard && hasPropertyAccess) {
        const paramName = Array.from(anyParamNames)[0];
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
