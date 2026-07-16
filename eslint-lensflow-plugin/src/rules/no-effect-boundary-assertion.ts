import { ESLintUtils, TSESLint } from "@typescript-eslint/utils";
import ts from "typescript";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T12-effect-tracking.md");

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

        const symbol = innerType.aliasSymbol || innerType.getSymbol();
        if (!symbol) return;

        const name = symbol.name;
        if (!KNOWN_EFFECT_NAMES.has(name)) return;

        // Get type arguments from the declaration's type reference node
        const exprTsNode = parserServices.esTreeNodeToTSNodeMap.get(
          node.expression,
        );
        const exprSym = checker.getSymbolAtLocation(exprTsNode);
        const decl = exprSym?.valueDeclaration;

        let typeRef: ts.TypeReferenceNode | undefined;

        if (decl && ts.isVariableDeclaration(decl)) {
          if (decl.type && ts.isTypeReferenceNode(decl.type)) {
            // Explicit type annotation: declare const either: Either<AppError, User>
            typeRef = decl.type;
          } else if (decl.initializer && ts.isCallExpression(decl.initializer)) {
            // Inferred from function call: const task = fetchUser(1)
            const sig = checker.getResolvedSignature(decl.initializer);
            if (sig) {
              const dec = sig.getDeclaration();
              if (
                (ts.isFunctionDeclaration(dec) || ts.isMethodDeclaration(dec)) ||
                ts.isFunctionTypeNode(dec)
              ) {
                if (dec.type && ts.isTypeReferenceNode(dec.type)) {
                  typeRef = dec.type;
                }
              }
            }
          }
        }

        if (
          !typeRef?.typeArguments ||
          typeRef.typeArguments.length < 2
        ) {
          return;
        }

        const typeArgs = typeRef.typeArguments.map((ta: ts.TypeNode) =>
          checker.getTypeFromTypeNode(ta),
        );
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
              url: URL,
            },
          });
        }
      },
    };
  },
});
