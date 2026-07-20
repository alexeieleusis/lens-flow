import type { TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import {
  createFunctionParamVisitor,
  checkMutableArrayParam,
} from "../utils/visitor-helpers.js";

const URL = knowledgeUrl("catalog/T08-variance-subtyping.md");

export default createRule({
  name: "no-mutable-array-parameter",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow mutable array types (`T[]` or `Array<T>`) in function parameters",
    },
    messages: {
      mutableArrayParam:
        "Parameter \"{{name}}\" uses mutable array type \"{{type}}\". Use \"readonly T[]\" or \"ReadonlyArray<T>\" to prevent unsound covariant assignment. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context) {
    function checkParameter(param: TSESTree.Parameter) {
      const result = checkMutableArrayParam(param, context.sourceCode);
      if (!result) return;
      context.report({
        node: param,
        messageId: "mutableArrayParam",
        data: { name: result.paramName, type: result.typeText, url: URL },
      });
    }

    return createFunctionParamVisitor(checkParameter);
  },
});
