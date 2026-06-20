import { ESLintUtils } from "@typescript-eslint/utils";
import type { TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

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
    const parserServices = ESLintUtils.getParserServices(context, { allowNoProject: true });
    const program = parserServices.program;
    if (!program) return {};

    const checker = program.getTypeChecker();
    const esTreeNodeToTSNodeMap = parserServices.esTreeNodeToTSNodeMap;

    return {
      TSAsExpression(node) {
        if (node.typeAnnotation.type !== "TSAnyKeyword") return;

        const parent = node.parent;
        if (
          parent.type !== "MemberExpression" ||
          parent.object !== node
        ) {
          return;
        }

        const tsNode = esTreeNodeToTSNodeMap.get(node.expression);
        if (!tsNode) return;
        const exprType = checker.getTypeAtLocation(tsNode);
        if (!exprType.isUnion()) return;

        context.report({ node, messageId: "capabilityProbe" });
      },
    };
  },
});
