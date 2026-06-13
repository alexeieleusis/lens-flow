import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { createFunctionParamVisitor } from "../utils/visitor-helpers.js";

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
        "Parameter \"{{name}}\" uses mutable array type \"{{type}}\". Use `readonly {{elem}}[]` or `ReadonlyArray<{{elem}}>`. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/usecases/UC17-variance.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"mutableArrayParam", []>) {
    function checkParameter(param: TSESTree.Parameter) {
      const inner = param.type === "TSParameterProperty" ? param.parameter : param;
      const typeAnn = inner.typeAnnotation?.typeAnnotation;
      if (!typeAnn) return;

      const sourceCode = context.sourceCode;

      // Get the parameter name (handles destructured params too)
      let paramName = "?";
      if (inner.type === "Identifier") {
        paramName = inner.name;
      }

      // Check T[] (TSArrayType) — readonly T[] produces TSReadonlyType, so this only matches mutable arrays
      if (typeAnn.type === "TSArrayType") {
        const elem = sourceCode.getText(typeAnn.elementType);
        const typeText = sourceCode.getText(typeAnn);
        context.report({
          node: param,
          messageId: "mutableArrayParam",
          data: { name: paramName, type: typeText, elem },
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
        const typeText = sourceCode.getText(typeAnn);
        const elem =
          typeAnn.typeArguments && typeAnn.typeArguments.params.length > 0
            ? sourceCode.getText(typeAnn.typeArguments.params[0])
            : "T";
        context.report({
          node: param,
          messageId: "mutableArrayParam",
          data: { name: paramName, type: typeText, elem },
        });
      }
    }

    return createFunctionParamVisitor(checkParameter);
  },
});
