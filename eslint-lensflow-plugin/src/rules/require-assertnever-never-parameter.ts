import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

export default createRule({
  name: "require-assertnever-never-parameter",
  meta: {
    type: "problem",
    docs: {
      description:
        "Enforce that assertNever / assertExhaustive functions have a parameter typed as `never`",
    },
    messages: {
      badParamType:
        "The `{{name}}` parameter must be typed as `never` to preserve exhaustiveness checking. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T34-never-bottom.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"badParamType", []>) {
    const assertNeverPattern = /^assertNever$/;
    const assertExhaustivePattern = /^assertExhaustive$/;

    function checkFunction(
      node: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression,
    ) {
      let funcName: string | undefined;

      if (node.type === "FunctionDeclaration" && node.id) {
        funcName = node.id.name;
      } else {
        const parent = node.parent;
        if (
          parent?.type === "VariableDeclarator" &&
          parent.id.type === "Identifier"
        ) {
          funcName = parent.id.name;
        }
      }

      if (!funcName) return;
      if (
        !assertNeverPattern.test(funcName) &&
        !assertExhaustivePattern.test(funcName)
      )
        return;

      const firstParam = node.params[0];
      if (firstParam?.type !== "Identifier") return;

      const typeAnn = firstParam.typeAnnotation?.typeAnnotation;
      if (typeAnn && typeAnn.type !== "TSNeverKeyword") {
        context.report({
          node: firstParam.typeAnnotation ?? firstParam,
          messageId: "badParamType",
          data: {
            name: firstParam.name,
          },
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
