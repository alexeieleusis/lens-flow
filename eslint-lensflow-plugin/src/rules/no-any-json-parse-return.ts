import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

function isJsonParseCall(node: TSESTree.Node): boolean {
  return (
    node.type === "CallExpression" &&
    node.callee.type === "MemberExpression" &&
    !node.callee.computed &&
    node.callee.property.type === "Identifier" &&
    node.callee.property.name === "parse" &&
    node.callee.object.type === "Identifier" &&
    node.callee.object.name === "JSON"
  );
}

function isAstNode(value: unknown): value is TSESTree.Node {
  return value != null && typeof value === "object" && "type" in value;
}

function childHasJsonParse(
  child: unknown,
  visited: Set<object>,
): boolean {
  if (Array.isArray(child)) {
    for (const item of child) {
      if (isAstNode(item) && findJsonParse(item, visited)) return true;
    }
  } else if (isAstNode(child)) {
    if (findJsonParse(child, visited)) return true;
  }
  return false;
}

function findJsonParse(node: TSESTree.Node, visited = new Set<object>()): boolean {
  if (visited.has(node)) return false;
  visited.add(node);

  if (isJsonParseCall(node)) return true;

  for (const key of Object.keys(node)) {
    if (key === "parent" || key === "loc" || key === "range") continue;

    const child = (node as unknown as Record<string, unknown>)[key];
    if (child == null) continue;

    if (childHasJsonParse(child, visited)) return true;
  }

  return false;
}

export default createRule({
  name: "no-any-json-parse-return",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow functions that return `any` from a `JSON.parse` call, shadowing null safety at the untrusted data boundary.",
    },
    messages: {
      anyJsonParseReturn:
        "Function returns `any` from `JSON.parse`. Use a concrete return type and validate the parsed data. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T13-null-safety.md",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"anyJsonParseReturn", []>) {
    function checkFunction(
      node:
        | TSESTree.TSFunctionType
        | TSESTree.TSDeclareFunction
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression,
    ) {
      const returnType =
        "returnType" in node ? node.returnType : undefined;
      if (returnType?.typeAnnotation.type !== "TSAnyKeyword") {
        return;
      }

      let body: TSESTree.Node | null = null;

      if (node.type === "ArrowFunctionExpression") {
        body = node.body;
      } else if (node.type === "TSDeclareFunction") {
        return;
      } else if (node.type === "TSFunctionType") {
        return;
      } else if (node.body) {
        body = node.body;
      }

      if (!body) return;

      if (findJsonParse(body)) {
        context.report({
          node,
          messageId: "anyJsonParseReturn",
        });
      }
    }

    return {
      TSFunctionType(node) {
        checkFunction(node);
      },
      TSDeclareFunction(node) {
        checkFunction(node);
      },
      FunctionDeclaration(node) {
        checkFunction(node);
      },
      FunctionExpression(node) {
        checkFunction(node);
      },
      ArrowFunctionExpression(node) {
        checkFunction(node);
      },
    };
  },
});
