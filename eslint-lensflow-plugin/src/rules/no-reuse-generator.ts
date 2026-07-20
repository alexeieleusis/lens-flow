import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

const URL = knowledgeUrl("catalog/T64-async-iteration.md");

function findBinding(
  scope: TSESLint.Scope.Scope | null,
  name: string,
  targetId: TSESTree.Identifier,
): TSESLint.Scope.Variable | null {
  for (let s: TSESLint.Scope.Scope | null = scope; s; s = s.upper) {
    const binding = s.set.get(name);
    if (binding?.identifiers.includes(targetId)) {
      return binding;
    }
  }
  return null;
}

export default createRule({
  name: "no-reuse-generator",
  meta: {
    type: "problem",
    docs: {
      description:
        "Flag async iterable call results used in multiple for-await-of loops — a common pattern for accidentally reusing a single-use async generator",
    },
    messages: {
      reuseGenerator:
        "Async generator instance '{{name}}' is reused in a second for await...of loop. Generators are single-use; the second iteration yields nothing. Create a fresh instance per loop. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"reuseGenerator", []>) {
    const callExprVars = new Set<TSESLint.Scope.Variable>();
    const forAwaitOfCounts = new Map<TSESLint.Scope.Variable, number>();

    return {
      VariableDeclarator(node) {
        if (
          node.init &&
          node.id.type === "Identifier" &&
          (node.init.type === "CallExpression" ||
            node.init.type === "NewExpression")
        ) {
          const scope = context.sourceCode.getScope(node);
          const binding = findBinding(scope, node.id.name, node.id);
          if (binding) {
            callExprVars.add(binding);
          }
        }
      },

      AssignmentExpression(node) {
        if (
          node.operator === "=" &&
          node.left.type === "Identifier" &&
          (node.right.type === "CallExpression" ||
            node.right.type === "NewExpression")
        ) {
          const left = node.left;
          const scope = context.sourceCode.getScope(left);
          let binding: TSESLint.Scope.Variable | null = null;
          for (let s: TSESLint.Scope.Scope | null = scope; s; s = s.upper) {
            const v = s.set.get(left.name);
            if (v?.references.some((ref) => ref.identifier === left)) {
              binding = v;
              break;
            }
          }
          if (binding && callExprVars.has(binding)) {
            forAwaitOfCounts.set(binding, 0);
          }
        }
      },

      ForOfStatement(node) {
        if (!node.await) return;

        const right = node.right;
        if (right.type !== "Identifier") return;

        const scope = context.sourceCode.getScope(right);
        let binding: TSESLint.Scope.Variable | null = null;
        for (let s: TSESLint.Scope.Scope | null = scope; s; s = s.upper) {
          const v = s.set.get(right.name);
          if (v?.references.some((ref) => ref.identifier === right)) {
            binding = v;
            break;
          }
        }
        if (!binding) return;

        if (!callExprVars.has(binding)) return;

        const currentCount = (forAwaitOfCounts.get(binding) ?? 0) + 1;
        forAwaitOfCounts.set(binding, currentCount);

        if (currentCount >= 2) {
          context.report({
            node,
            messageId: "reuseGenerator",
            data: { name: right.name, url: URL },
          });
        }
      },
    };
  },
});
