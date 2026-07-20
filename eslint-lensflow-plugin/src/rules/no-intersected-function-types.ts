import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

const URL = knowledgeUrl("catalog/T02-union-intersection.md");

export default createRule({
  name: "no-intersected-function-types",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow intersecting function or constructor types, which creates overloaded signatures that are rarely intended",
    },
    messages: {
      intersectedFunctions:
        "Intersecting {{count}} function types creates an overloaded function that is rarely intended. Use function overloads instead. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"intersectedFunctions", []>) {
    return {
      TSIntersectionType(node) {
        const functionTypes = node.types.filter(
          (member): member is TSESTree.TSFunctionType | TSESTree.TSConstructorType =>
            member.type === "TSFunctionType" || member.type === "TSConstructorType",
        );
        if (functionTypes.length >= 2) {
          context.report({
            node,
            messageId: "intersectedFunctions",
            data: {
              count: String(functionTypes.length),
              url: URL,
            },
          });
        }
      },
    };
  },
});
