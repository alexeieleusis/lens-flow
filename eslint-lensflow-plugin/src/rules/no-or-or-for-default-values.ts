import { createRule } from "../utils/rule-creator.js";
import type { TSESTree, TSESLint } from "@typescript-eslint/utils";

function isLikelyTarget(node: TSESTree.Node): boolean {
  if (node.type === "ChainExpression") {
    node = node.expression;
  }
  return node.type === "MemberExpression" || node.type === "Identifier";
}

function isDefaultValueType(node: TSESTree.Node): boolean {
  if (node.type === "Literal") {
    // Skip null — `x || null` -> `x ?? null` is a semantic no-op
    return node.value !== null;
  }
  return (
    node.type === "ArrayExpression" ||
    node.type === "ObjectExpression"
  );
}

export default createRule({
  name: "no-or-or-for-default-values",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `||` for default values — prefer `??` to preserve legitimate falsy values",
    },
    messages: {
      preferNullishCoalescing:
        "Use `??` instead of `||` for default values. The `||` operator replaces all falsy values (0, \"\", false) with the fallback, while `??` only replaces null and undefined. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T13-null-safety.md",
    },
    schema: [
      {
        type: "object",
        properties: {
          ignorePatterns: {
            type: "array",
            items: { type: "string" },
            description:
              "Array of regex patterns for variable names to ignore",
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: "code",
  },
  defaultOptions: [{ ignorePatterns: [] }],
  create(context: TSESLint.RuleContext<"preferNullishCoalescing", [{ ignorePatterns: string[] }]>) {
    const [{ ignorePatterns = [] } = {}] = context.options ?? [];
    const patterns = ignorePatterns.map((p) => {
      try {
        return new RegExp(p);
      } catch (e: any) {
        throw new Error(
          `Invalid regex pattern in ignorePatterns option: "${p}". ${e.message}`,
        );
      }
    });

    function shouldIgnore(node: TSESTree.Node): boolean {
      if (node.type !== "Identifier") return false;
      return patterns.some((regex) => regex.test(node.name));
    }

    return {
      LogicalExpression(node) {
        if (node.operator !== "||") return;

        const left = node.left;
        const right = node.right;

        if (!isDefaultValueType(right)) return;
        if (!isLikelyTarget(left)) return;
        if (shouldIgnore(left)) return;

        context.report({
          node,
          messageId: "preferNullishCoalescing",
          fix(fixer) {
            const sourceCode = context.sourceCode;
            const operatorToken = sourceCode.getTokenAfter(
              left,
              (token) =>
                token.type === "Punctuator" && token.value === "||",
            );
            if (!operatorToken) return null;
            return fixer.replaceText(operatorToken, "??");
          },
        });
      },
    };
  },
});
