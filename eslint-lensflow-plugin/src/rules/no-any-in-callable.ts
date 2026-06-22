import { createRule } from "../utils/rule-creator.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import {
  createNoAnyParamChecker,
  createNoAnyParamTypeChecker,
} from "../utils/no-any-param-checker.js";

export default createRule({
  name: "no-any-in-callable",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `any` as a parameter or return type in callable signatures instead of a proper generic or explicit type.",
    },
    messages: {
      anyParam:
        "Parameter '{{name}}' is typed as `any`. Use a generic or explicit type to preserve type information. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T22-callable-typing.md",
      anyReturn:
        "Return type is `any`. Use a generic or explicit return type to preserve type information. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T22-callable-typing.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"anyParam" | "anyReturn", []>) {
    function checkReturn(
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression
        | TSESTree.TSFunctionType
        | TSESTree.TSConstructorType
        | TSESTree.TSMethodSignature
        | TSESTree.TSDeclareFunction
        | TSESTree.TSCallSignatureDeclaration,
    ) {
      if ("declare" in node && node.declare) return;
      if (node.returnType?.typeAnnotation?.type === "TSAnyKeyword") {
        context.report({ node: node.returnType, messageId: "anyReturn" });
      }
    }

    return {
      ...createNoAnyParamChecker("anyParam")(context),
      ...createNoAnyParamTypeChecker("anyParam")(context),
      TSFunctionType(node: TSESTree.TSFunctionType) {
        checkReturn(node);
      },
      TSConstructorType(node: TSESTree.TSConstructorType) {
        checkReturn(node);
      },
      TSMethodSignature(node: TSESTree.TSMethodSignature) {
        checkReturn(node);
      },
      TSDeclareFunction(node: TSESTree.TSDeclareFunction) {
        checkReturn(node);
      },
      TSCallSignatureDeclaration(node: TSESTree.TSCallSignatureDeclaration) {
        checkReturn(node);
      },
    };
  },
});
