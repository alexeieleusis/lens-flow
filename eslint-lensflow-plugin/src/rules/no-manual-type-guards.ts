import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { walk } from "../utils/ast-helpers.js";

function countGuardChecks(node: TSESTree.Node): number {
  let count = 0;
  walk(node, (n) => {
    if (n.type === "UnaryExpression" && n.operator === "typeof") count++;
    if (n.type === "BinaryExpression" && n.operator === "in") count++;
  });
  return count;
}

export default createRule({
  name: "no-manual-type-guards",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow manual runtime type guard functions using typeof/in checks instead of schema validation",
    },
    messages: {
      manualTypeGuard:
        "Manual type guard with {{count}} runtime checks. Use a schema validator (e.g., Zod) as the single source of truth instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC19-serialization.md",
    },
    schema: [
      {
        type: "object",
        properties: {
          minChecks: {
            type: "number",
            minimum: 1,
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
  },
  defaultOptions: [{ minChecks: 3 }],
  create(context: TSESLint.RuleContext<"manualTypeGuard", [{ minChecks: number }]>) {
    const [{ minChecks = 3 } = {}] = context.options;

    function checkFunction(
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression
        | TSESTree.TSEmptyBodyFunctionExpression,
    ) {
      const returnType = node.returnType?.typeAnnotation;

      if (returnType?.type !== "TSTypePredicate") {
        return;
      }

      const body = node.body;
      if (!body) return;

      const guardCheckCount = countGuardChecks(body);

      if (guardCheckCount >= minChecks) {
        context.report({
          node,
          messageId: "manualTypeGuard",
          data: {
            count: String(guardCheckCount),
          },
        });
      }
    }

    return {
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction,
      TSEmptyBodyFunctionExpression: checkFunction,
      TSFunctionType() {
        return;
      },
      TSMethodSignature() {
        return;
      },
      MethodDefinition(node: TSESTree.MethodDefinition) {
        if (node.value) checkFunction(node.value);
      },
    };
  },
});
