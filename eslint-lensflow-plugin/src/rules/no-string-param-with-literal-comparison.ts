import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

function isParamLiteralComparison(
  node: Record<string, unknown>,
  paramName: string,
): string | null {
  if (node.type !== "BinaryExpression" || node.operator !== "===") {
    return null;
  }

  const left = node.left as Record<string, unknown> | undefined;
  const right = node.right as Record<string, unknown> | undefined;

  if (
    left?.type === "Identifier" &&
    left.name === paramName &&
    right?.type === "Literal" &&
    typeof right.value === "string"
  ) {
    return String(right.value);
  }

  if (
    right?.type === "Identifier" &&
    right.name === paramName &&
    left?.type === "Literal" &&
    typeof left.value === "string"
  ) {
    return String(left.value);
  }

  return null;
}

function collectLiteralComparisons(
  body: TSESTree.Statement | TSESTree.Expression | null | undefined,
  paramName: string,
): string[] {
  const literals = new Set<string>();

  function traverse(node: unknown): void {
    if (!node || typeof node !== "object") return;
    if (!("type" in node)) return;

    const typedNode = node as Record<string, unknown>;
    const matched = isParamLiteralComparison(typedNode, paramName);
    if (matched) {
      literals.add(matched);
    }

    const keys = Object.keys(typedNode).filter((k) => k !== "parent");
    for (const key of keys) {
      const child = typedNode[key];
      if (Array.isArray(child)) {
        for (const item of child) {
          traverse(item);
        }
      } else if (child && typeof child === "object") {
        traverse(child);
      }
    }
  }

  traverse(body);
  return [...literals];
}

export default createRule({
  name: "no-string-param-with-literal-comparison",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow function parameters typed as `string` that are compared against specific string literals inside the function body",
    },
    messages: {
      stringParamWithLiteralComparison:
        "Parameter '{{name}}' is typed as `string` but compared against literals [{{literals}}]. Consider using a literal union type instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T52-literal-types.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"stringParamWithLiteralComparison", []>) {
    function checkFunction(
      params: readonly TSESTree.Parameter[],
      body: TSESTree.BlockStatement | TSESTree.Expression | null | undefined,
    ): void {
      for (const param of params) {
        if (
          param.type === "Identifier" &&
          param.typeAnnotation?.typeAnnotation.type === "TSStringKeyword"
        ) {
          const paramName = param.name;
          const literals = collectLiteralComparisons(body, paramName);
          if (literals.length > 0) {
            context.report({
              node: param.typeAnnotation.typeAnnotation,
              messageId: "stringParamWithLiteralComparison",
              data: {
                name: paramName,
                literals: literals.join("', '"),
              },
            });
          }
        }
      }
    }

    return {
      FunctionDeclaration(node) {
        checkFunction(node.params, node.body);
      },

      FunctionExpression(node) {
        checkFunction(node.params, node.body);
      },

      ArrowFunctionExpression(node) {
        checkFunction(node.params, node.body);
      },
    };
  },
});
