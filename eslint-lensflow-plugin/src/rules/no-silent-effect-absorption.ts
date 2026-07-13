import ts from "typescript";
import { ESLintUtils, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

const KNOWN_EFFECT_NAMES = [
  "Result",
  "Either",
  "TaskEither",
  "IOEither",
  "Effect",
  "IO",
  "LazyIO",
  "Task",
];

const TRANSFORM_METHODS = new Set(["map", "flatMap", "chain", "ap"]);
const ERROR_HANDLING_METHODS = new Set([
  "match",
  "mapErr",
  "bimap",
  "mapBoth",
  "fold",
  "isOK",
  "isOk",
  "isErr",
  "unwrapOr",
  "unwrapOrElse",
  "mapResult",
  "mapError",
  "mapLeft",
  "swap",
]);

function isEffectType(type: ts.Type): boolean {
  // Handle union types (e.g. Effect<string, Error> | undefined)
  if (ts.TypeFlags.Union & type.flags) {
    const unionType = type as ts.UnionType;
    return unionType.types.some((t) => isEffectType(t));
  }

  const typeName = type.symbol?.name;
  if (typeName) {
    if (KNOWN_EFFECT_NAMES.some((p) => typeName.includes(p))) {
      return true;
    }
  }

  const props = type.getProperties();
  const propNames = new Set(props.map((p) => p.name));

  // Structural: need BOTH transform AND error-handling methods
  const hasTransform = propNames.has("map") || propNames.has("flatMap") || propNames.has("chain");
  const hasErrorHandling = Array.from(ERROR_HANDLING_METHODS).some((n) => propNames.has(n));

  return hasTransform && hasErrorHandling;
}

export default createRule({
  name: "no-silent-effect-absorption",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow calling .map() or .chain() on an effect type (Result/Either/Effect) without handling the error channel",
    },
    messages: {
      silentAbsorption:
        "Called .{{method}}() on an effect type without handling the error channel. Use .match(), .unwrapOrElse(), or another explicit error handler. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T12-effect-tracking.md",
    },
    schema: [
      {
        type: "object",
        properties: {
          allowedTerminators: {
            type: "array",
            items: { type: "string" },
            description:
              "Method names that count as valid error-handling terminators.",
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
  },
  defaultOptions: [
    {
      allowedTerminators: [
        "match",
        "unwrapOrElse",
        "unwrapOr",
        "mapErr",
        "bimap",
        "mapBoth",
        "fold",
        "mapResult",
        "mapError",
        "mapLeft",
        "swap",
        "getOrElse",
        "orElse",
      ],
    },
  ],
  create(
    context: TSESLint.RuleContext<"silentAbsorption", [{ allowedTerminators: string[] }]>
  ) {
    const parserServices = ESLintUtils.getParserServices(context, true);
    if (!parserServices.program) return {};

    const DEFAULT_TERMINATORS = [
      "match",
      "unwrapOrElse",
      "unwrapOr",
      "mapErr",
      "bimap",
      "mapBoth",
      "fold",
      "mapResult",
      "mapError",
      "mapLeft",
      "swap",
      "getOrElse",
      "orElse",
    ];
    const { allowedTerminators = DEFAULT_TERMINATORS } = context.options[0] ?? {};
    const terminatorSet = new Set(allowedTerminators);

    return {
      ExpressionStatement(node) {
        let expr = node.expression;

        // Unwrap ChainExpression from optional chaining (e.g. r?.map(...))
        if (expr.type === "ChainExpression") {
          expr = expr.expression;
        }

        if (expr.type !== "CallExpression") return;

        const callee = expr.callee;
        if (callee.type !== "MemberExpression") return;

        const prop = callee.property;
        if (prop.type !== "Identifier") return;

        const methodName = prop.name;

        // Skip allowed terminators
        if (terminatorSet.has(methodName)) return;

        // Only flag .map() and .chain() calls
        if (!TRANSFORM_METHODS.has(methodName)) return;

        const objectType = parserServices.getTypeAtLocation(callee.object);
        if (isEffectType(objectType)) {
          context.report({
            node,
            messageId: "silentAbsorption",
            data: {
              method: methodName,
            },
          });
        }
      },
    };
  },
});
