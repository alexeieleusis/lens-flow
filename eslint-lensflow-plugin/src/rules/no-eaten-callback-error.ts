import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

function collectParamIdentifiers(node: TSESTree.Node): string[] {
  if (node.type === "Identifier") return [node.name];
  if (node.type === "ObjectPattern") {
    return node.properties.flatMap((prop) => {
      if (prop.type === "Property") {
        return collectParamIdentifiers(prop.value);
      }
      if (prop.type === "RestElement") {
        return collectParamIdentifiers(prop.argument);
      }
      return [];
    });
  }
  if (node.type === "ArrayPattern") {
    return node.elements.flatMap((el) => {
      if (el === null) return [];
      if (el.type === "RestElement") {
        return collectParamIdentifiers(el.argument);
      }
      return collectParamIdentifiers(el);
    });
  }
  if (node.type === "AssignmentPattern") {
    return collectParamIdentifiers(node.left);
  }
  if (node.type === "RestElement") {
    return collectParamIdentifiers(node.argument);
  }
  return [];
}

function getParamDisplayName(node: TSESTree.Node): string {
  if (node.type === "Identifier") return node.name;
  if (node.type === "AssignmentPattern") return getParamDisplayName(node.left);
  if (node.type === "RestElement") return getParamDisplayName(node.argument);
  return "destructured params";
}

function isEffectivelyEmpty(stmt: TSESTree.Statement): boolean {
  if (stmt.type === "EmptyStatement") return true;
  if (stmt.type === "BlockStatement") {
    return stmt.body.every((s) => isEffectivelyEmpty(s));
  }
  return false;
}

function reportEatenErrorIfApplicable(
  callback: TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression,
  errorParamIds: string[],
  paramName: string,
  context: Parameters<ReturnType<typeof createRule>["create"]>[0],
) {
  if (callback.body.type === "BlockStatement") {
    const { body } = callback.body;
    const isEmptyOrOnlyEmpty = body.every((stmt) => isEffectivelyEmpty(stmt));

    if (isEmptyOrOnlyEmpty) {
      context.report({
        node: callback,
        messageId: "emptyCatch",
      });
      return;
    }
  }

  if (errorParamIds.length === 0) return;

  const paramBindings = context
    .getDeclaredVariables(callback)
    .filter((v) => errorParamIds.includes(v.name));

  if (paramBindings.length > 0 && paramBindings.every((b) => b.references.length === 0)) {
    context.report({
      node: callback,
      messageId: "ignoredParam",
      data: { param: paramName },
    });
  }
}

export default createRule({
  name: "no-eaten-callback-error",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow .catch() handlers that silently swallow errors",
    },
    messages: {
      emptyCatch:
        "The .catch() handler has an empty body and silently swallows errors. Handle the error or rethrow it. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T12-effect-tracking.md",
      ignoredParam:
        "The .catch() handler does not use the error parameter '{{param}}'. Handle the error or rethrow it. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T12-effect-tracking.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"emptyCatch" | "ignoredParam", []>) {
    return {
      CallExpression(node) {
        const { callee, arguments: args } = node;
        if (callee.type !== "MemberExpression") return;
        if (callee.property.type !== "Identifier") return;
       if (callee.property.name !== "catch") return;

        const callback = args[0];
        if (!callback) return;
        if (
          callback.type !== "ArrowFunctionExpression" &&
          callback.type !== "FunctionExpression"
        )
          return;

        const firstParam = callback.params[0];
        if (!firstParam) return;

        const errorParamIds = collectParamIdentifiers(firstParam);
        const paramName = getParamDisplayName(firstParam);

        reportEatenErrorIfApplicable(callback, errorParamIds, paramName, context);
      },
    };
  },
});
