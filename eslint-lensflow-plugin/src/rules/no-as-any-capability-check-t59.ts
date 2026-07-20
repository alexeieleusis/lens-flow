import { ESLintUtils } from "@typescript-eslint/utils";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T59-existential-types.md");

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
         "Using `as any` to check for a property or method instead of enforcing capability through a proper interface. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"capabilityProbe", []>) {
    const parserServices = ESLintUtils.getParserServices(context, true);
    const program = parserServices.program;
    if (!program) return {};

    const checker = program.getTypeChecker();
    const esTreeNodeToTSNodeMap = parserServices.esTreeNodeToTSNodeMap;

    return {
      TSAsExpression(node) {
        if (node.typeAnnotation.type !== "TSAnyKeyword") return;

        let effectiveChild: TSESTree.TSAsExpression | TSESTree.TSNonNullExpression =
          node;
        let parent = node.parent;
        if (parent.type === "TSNonNullExpression") {
          effectiveChild = parent;
          parent = parent.parent;
        }
        if (
          parent.type !== "MemberExpression" ||
          parent.object !== effectiveChild
        ) {
          return;
        }

        const tsNode = esTreeNodeToTSNodeMap.get(node.expression);
        if (!tsNode) return;
        const exprType = checker.getTypeAtLocation(tsNode);
        if (!exprType.isUnion()) return;

        context.report({ node, messageId: "capabilityProbe", data: { url: URL } });
      },
    };
  },
});
