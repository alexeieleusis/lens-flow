import { ESLintUtils, TSESLint } from "@typescript-eslint/utils";
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

function parseGenericType(typeStr: string): {
  name: string;
  params: string[];
} | null {
  const match = /^(\w+)<(.+)>$/.exec(typeStr);
  if (!match) return null;
  return {
    name: match[1],
    params: match[2].split(",").map((s) => s.trim()),
  };
}

function isEffectTypeName(name: string): boolean {
  return KNOWN_EFFECT_NAMES.has(name);
}

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
    const parserServices = ESLintUtils.getParserServices(context);
    const program = parserServices.program;
    if (!program) return {};

    const checker = program.getTypeChecker();

    return {
      TSAsExpression(node) {
        const innerType = parserServices.getTypeAtLocation(node.expression);
        const innerTypeStr = checker.typeToString(innerType);

        const parsed = parseGenericType(innerTypeStr);
        if (!parsed) return;

        const { name, params } = parsed;

        if (!isEffectTypeName(name)) return;

        if (params.length < 2) return;

        const successParam = isSuccessFromFirstParam(name) ? params[0] : params[1];

        const typeNodeTs =
          parserServices.esTreeNodeToTSNodeMap.get(node.typeAnnotation);
        if (!typeNodeTs) return;

        const assertedType = checker.getTypeFromTypeNode(
          typeNodeTs as import("typescript").TypeNode,
        );
        const assertedTypeStr = checker.typeToString(assertedType);

        if (assertedTypeStr === successParam) {
          context.report({
            node,
            messageId: "effectBoundaryBypass",
            data: {
              effectType: innerTypeStr,
              assertedType: assertedTypeStr,
              url: DOCS_URL,
            },
          });
        }
      },
    };
  },
});
