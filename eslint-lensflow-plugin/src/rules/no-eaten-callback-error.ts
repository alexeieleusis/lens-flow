import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T12-effect-tracking.md");

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

function isAstNode(val: unknown): val is TSESTree.Node {
  return val != null && typeof val === "object" && "type" in val;
}

function collectNodeChildren(node: TSESTree.Node): TSESTree.Node[] {
  const children: TSESTree.Node[] = [];
  for (const key in node) {
    if (key === "parent" || key === "loc" || key === "range") continue;
    const val = (node as unknown as Record<string, unknown>)[key];
    if (val == null || typeof val !== "object") continue;
    if (Array.isArray(val)) {
      for (const item of val) {
        if (isAstNode(item)) children.push(item);
      }
    } else if (isAstNode(val)) {
      children.push(val);
    }
  }
  return children;
}

function walkNode(node: TSESTree.Node, refs: Set<string>) {
  if (node.type === "Identifier") {
    refs.add(node.name);
    return;
  }
  for (const child of collectNodeChildren(node)) {
    walkNode(child, refs);
  }
}

function collectReferencedIdentifiers(node: TSESTree.Node): Set<string> {
  const refs = new Set<string>();
  walkNode(node, refs);
  return refs;
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
        data: { url: URL },
      });
      return;
    }
  }

  if (errorParamIds.length === 0) return;

  const bodyToCheck = callback.body;
  const referencedIds = collectReferencedIdentifiers(bodyToCheck);
  const anyParamUsed = errorParamIds.some((id) => referencedIds.has(id));

  if (!anyParamUsed) {
    context.report({
      node: callback,
      messageId: "ignoredParam",
      data: { param: paramName, url: URL },
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
        "The .catch() handler has an empty body and silently swallows errors. Handle the error or rethrow it. See: {{url}}",
      ignoredParam:
        "The .catch() handler does not use the error parameter '{{param}}'. Handle the error or rethrow it. See: {{url}}",
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
