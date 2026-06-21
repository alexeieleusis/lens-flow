import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "no-intersected-function-types",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow intersecting function or constructor types, which creates overloaded signatures rarely intended",
    },
    messages: {
      intersectedFunctions:
        "Intersecting {{count}} function/constructor types creates an overloaded signature that is rarely intended. Use function/constructor overloads instead.",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"intersectedFunctions", []>) {
    return {
      TSIntersectionType(node) {
        const functionTypes = node.types.filter(
          (member) => member.type === "TSFunctionType" || member.type === "TSConstructorType",
        );
        if (functionTypes.length >= 2) {
          context.report({
            node,
            messageId: "intersectedFunctions",
            data: {
              count: String(functionTypes.length),
            },
          });
        }
      },
    };
  },
});
