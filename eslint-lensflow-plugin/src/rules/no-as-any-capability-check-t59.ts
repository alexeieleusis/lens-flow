import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "no-as-any-capability-check-t59",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `(x as any).property` capability checks on union-typed values",
    },
    messages: {
      capabilityProbe:
        "Using `as any` to check for a property or method instead of enforcing capability through a proper interface. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T59-existential-types.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"capabilityProbe", []>) {
    return {
      TSAsExpression(node) {
        if (node.typeAnnotation.type !== "TSAnyKeyword") return;

        const parent = node.parent;

        if (
          parent.type === "MemberExpression" &&
          parent.object === node
        ) {
          context.report({ node, messageId: "capabilityProbe" });
          return;
        }

        if (
          parent.type === "IfStatement" &&
          parent.test === node
        ) {
          context.report({ node, messageId: "capabilityProbe" });
          return;
        }

        if (
          parent.type === "ConditionalExpression" &&
          parent.test === node
        ) {
          context.report({ node, messageId: "capabilityProbe" });
        }

        if (
          parent.type === "LogicalExpression" &&
          (parent.left === node || parent.right === node)
        ) {
          context.report({ node, messageId: "capabilityProbe" });
        }
      },
    };
  },
});
