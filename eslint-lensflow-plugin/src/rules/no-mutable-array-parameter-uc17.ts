import type { TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import {
  createFunctionParamVisitor,
  checkMutableArrayParam,
} from "../utils/visitor-helpers.js";

const URL = knowledgeUrl("usecases/UC17-variance.md");

export default createRule({
  name: "no-mutable-array-parameter-uc17",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow mutable array types in function parameters — use `readonly T[]` or `ReadonlyArray<T>` to prevent unsound covariant mutation.",
    },
    messages: {
      mutableArrayParam:
        'Parameter "{{name}}" uses mutable array type "{{type}}". Use `readonly {{elem}}[]` or `ReadonlyArray<{{elem}}>`. See: {{url}}',
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
        data: {
          name: result.paramName,
          type: result.typeText,
          elem: result.elemText,
          url: URL,
        },
      });
    }

    return createFunctionParamVisitor(checkParameter);
  },
});
