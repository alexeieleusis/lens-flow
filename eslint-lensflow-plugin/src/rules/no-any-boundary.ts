import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

const FUNCTION_TYPE_NODES = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
  "TSFunctionType",
  "TSDeclareFunction",
]);

const PARAM_TYPE_NODES = new Set(["Identifier", "RestElement", "TSParameterProperty", "ObjectPattern", "ArrayPattern"]);

function isAnyInAsExpression(
  node: TSESTree.TSAnyKeyword,
  parent: TSESTree.Node
): boolean {
  return parent.type === "TSAsExpression" && parent.typeAnnotation === node;
}

function isAnyInVarAnnotation(parent: TSESTree.Node): boolean {
  if (parent.type !== "TSTypeAnnotation") return false;
  const annotatedNode = parent.parent;
  const PATTERN_TYPES = new Set(["Identifier", "ObjectPattern", "ArrayPattern"]);
  return (
    annotatedNode &&
    PATTERN_TYPES.has(annotatedNode.type) &&
    annotatedNode.parent?.type === "VariableDeclarator"
  );
}

function isAnyInFunctionReturnType(
  parent: TSESTree.Node,
  grandparent: TSESTree.Node | undefined
): boolean {
  if (parent.type !== "TSTypeAnnotation") return false;
  if (!grandparent || !FUNCTION_TYPE_NODES.has(grandparent.type)) return false;
  return (
    (grandparent as TSESTree.FunctionDeclaration | TSESTree.TSFunctionType | TSESTree.TSDeclareFunction)
      .returnType === parent
  );
}

function isAnyInParameterType(
  grandparent: TSESTree.Node | undefined
): boolean {
  if (!grandparent || !PARAM_TYPE_NODES.has(grandparent.type)) return false;
  let candidate: TSESTree.Node | undefined = grandparent.parent;
  // Walk through AssignmentPattern wrappers (e.g., default params like `x: any = 1`)
  while (candidate && candidate.type === "AssignmentPattern") {
    candidate = candidate.parent;
  }
  return !!candidate && FUNCTION_TYPE_NODES.has(candidate.type);
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
