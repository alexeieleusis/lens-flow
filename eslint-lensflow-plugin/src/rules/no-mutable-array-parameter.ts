import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { createFunctionParamVisitor } from "../utils/visitor-helpers.js";

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
        "Parameter \"{{name}}\" uses mutable array type \"{{type}}\". Use \"readonly T[]\" or \"ReadonlyArray<T>\" to prevent unsound covariant assignment. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T08-variance-subtyping.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"mutableArrayParam", []>) {
    function checkParameter(param: TSESTree.Parameter) {
      if (param.type !== "Identifier") return;
      if (!param.typeAnnotation) return;

      const typeAnn = param.typeAnnotation.typeAnnotation;
      const paramName = param.name;

      // Check T[] (TSArrayType)
      // Note: readonly T[] produces TSReadonlyType, so this only matches mutable arrays
      if (typeAnn.type === "TSArrayType") {
        context.report({
          node: param,
          messageId: "mutableArrayParam",
          data: { name: paramName, type: "T[]" },
        });
        return;
      }

      // Check Array<T> (TSTypeReference with typeName "Array")
      // ReadonlyArray<T> has typeName "ReadonlyArray", so it won't match
      if (
        typeAnn.type === "TSTypeReference" &&
        typeAnn.typeName.type === "Identifier" &&
        typeAnn.typeName.name === "Array"
      ) {
        context.report({
          node: param,
          messageId: "mutableArrayParam",
          data: { name: paramName, type: "Array<T>" },
        });
      }
    }

    return createFunctionParamVisitor(checkParameter);
  },
});
