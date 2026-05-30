import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

export default createRule({
  name: "no-boolean-parse-return",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow parse/validate/check functions that return bare boolean instead of a typed Result with error details",
    },
    messages: {
      booleanParseReturn:
        "Function `{{name}}` returns `boolean` instead of a typed `Result<T, E>`. Callers can't distinguish failure reasons or recover the parsed value. Return `Result<T, E>` instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/usecases/UC08-error-handling.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"booleanParseReturn", []>) {
    const NAME_PATTERN = /^(parse|validate|check|parseAndValidate)/i;

    function checkFunction(node: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression) {
      const nameNode =
        node.type === "FunctionDeclaration" || node.type === "FunctionExpression"
          ? node.id
          : undefined;

      if (!nameNode) return;
      if (!NAME_PATTERN.test(nameNode.name)) return;

      const returnType = node.returnType?.typeAnnotation;
      if (returnType?.type === "TSBooleanKeyword") {
        context.report({
          node: nameNode,
          messageId: "booleanParseReturn",
          data: { name: nameNode.name },
        });
      }
    }

    return {
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction,
    };
  },
});
