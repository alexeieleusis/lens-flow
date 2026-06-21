import { ESLintUtils, TSESLint } from "@typescript-eslint/utils";
import type ts from "typescript";
import { createRule } from "../utils/rule-creator.js";

const DOCS_URL =
  "https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T12-effect-tracking.md";

const KNOWN_EFFECT_NAMES = new Set([
  "Result",
  "Either",
  "TaskEither",
  "IOEither",
  "Effect",
  "IO",
  "LazyIO",
  "Task",
]);

// Effect types where the success value is the first generic parameter
const FIRST_PARAM_SUCCESS = new Set([
  "Result",
  "Effect",
  "IO",
  "LazyIO",
  "Task",
]);

function isSuccessFromFirstParam(effectName: string): boolean {
  return FIRST_PARAM_SUCCESS.has(effectName);
}

export default createRule({
  name: "no-effect-boundary-assertion",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow using type assertion (as T) to extract the inner value from an effect type, bypassing the effect wrapper entirely.",
     },
    messages: {
      effectBoundaryBypass:
        "Using `as {{assertedType}}` to extract inner value from effect type `{{effectType}}`. Use pattern matching (e.g., _tag check) instead of type assertion. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"effectBoundaryBypass", []>) {
    const parserServices = ESLintUtils.getParserServices(context, true);
    const program = parserServices.program;
    if (!program) return {};

    const checker = program.getTypeChecker();

    return {
      TSAsExpression(node) {
        const innerType = parserServices.getTypeAtLocation(node.expression);

        // Use checker APIs instead of string parsing to handle nested generics
        const typeArgs = checker.getTypeArguments(innerType);
        if (!typeArgs || typeArgs.length < 2) return;

        const symbol = innerType.getSymbol() || innerType.getAliasSymbol();
        if (!symbol) return;

        const name = symbol.name;
        if (!KNOWN_EFFECT_NAMES.has(name)) return;

        const successIndex = isSuccessFromFirstParam(name) ? 0 : 1;
        const successType = typeArgs[successIndex];

        const typeNodeTs =
          parserServices.esTreeNodeToTSNodeMap.get(node.typeAnnotation);
        if (!typeNodeTs) return;

        const assertedType = checker.getTypeFromTypeNode(
          typeNodeTs as ts.TypeNode,
        );

        if (checker.isTypeAssignableTo(assertedType, successType)) {
          context.report({
            node,
            messageId: "effectBoundaryBypass",
            data: {
              effectType: checker.typeToString(innerType),
              assertedType: checker.typeToString(assertedType),
              url: DOCS_URL,
            },
          });
        }
      },
    };
  },
});
