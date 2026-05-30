import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

const FUNCTION_TYPE_NODES = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
]);

const PARAM_TYPE_NODES = new Set(["Identifier", "RestElement", "TSParameterProperty"]);

function isAnyInAsExpression(
  node: TSESTree.TSAnyKeyword,
  parent: TSESTree.Node
): boolean {
  return parent.type === "TSAsExpression" && parent.typeAnnotation === node;
}

function isAnyInVarAnnotation(parent: TSESTree.Node): boolean {
  if (parent.type !== "TSTypeAnnotation") return false;
  const idNode = parent.parent;
  return idNode?.type === "Identifier" && idNode.parent?.type === "VariableDeclarator";
}

function isAnyInFunctionReturnType(
  parent: TSESTree.Node,
  grandparent: TSESTree.Node | undefined
): boolean {
  if (parent.type !== "TSTypeAnnotation") return false;
  if (!grandparent || !FUNCTION_TYPE_NODES.has(grandparent.type)) return false;
  return (grandparent as TSESTree.FunctionDeclaration).returnType === parent;
}

function isAnyInParameterType(
  grandparent: TSESTree.Node | undefined
): boolean {
  if (!grandparent || !PARAM_TYPE_NODES.has(grandparent.type)) return false;
  const greatGrandparent = grandparent.parent;
  return !!(greatGrandparent && FUNCTION_TYPE_NODES.has(greatGrandparent.type));
}

export default createRule({
  name: "no-any-boundary",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `any` as a conversion boundary for external data instead of `unknown`",
    },
    messages: {
      anyInVarAnnotation:
        "Using `any` as variable type annotation disables type safety. Use `unknown` for external data boundaries. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T18-conversions-coercions.md",
      anyInAsExpression:
        "Casting to `any` disables type safety. Use `unknown` for external data boundaries. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T18-conversions-coercions.md",
      anyInFunctionType:
        "Using `any` in function parameter or return type disables type safety. Use `unknown` for external data boundaries. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T18-conversions-coercions.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"anyInAsExpression" | "anyInVarAnnotation" | "anyInFunctionType", []>) {
    return {
      TSAnyKeyword(node) {
        const parent = node.parent;
        const grandparent = parent.parent;

        if (isAnyInAsExpression(node, parent)) {
          context.report({ node, messageId: "anyInAsExpression" });
          return;
        }

        if (isAnyInVarAnnotation(parent)) {
          context.report({ node, messageId: "anyInVarAnnotation" });
          return;
        }

        if (isAnyInFunctionReturnType(parent, grandparent)) {
          context.report({ node, messageId: "anyInFunctionType" });
          return;
        }

        if (isAnyInParameterType(grandparent)) {
          context.report({ node, messageId: "anyInFunctionType" });
        }
      },
    };
  },
});
