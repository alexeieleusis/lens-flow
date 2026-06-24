import type { TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import {
  createFunctionParamVisitor,
  checkMutableArrayParam,
} from "../utils/visitor-helpers.js";

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
        "Parameter \"{{name}}\" uses mutable array type \"{{type}}\". Use `readonly {{elem}}[]` or `ReadonlyArray<{{elem}}>`. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC17-variance.md",
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
        },
      });
    }

    return createFunctionParamVisitor(checkParameter);
  },
});
