import ts from "typescript";
import { ESLintUtils, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const DOC_URL = knowledgeUrl("catalog/T04-generics-bounds.md");

export default createRule({
  name: "require-explicit-generic-in-promise-chain",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require explicit generic type arguments when calling a generic function returning `Promise<T>` in a chained `.then()` call.",
    },
    messages: {
      missingTypeArg:
        "Generic function returning `Promise<T>` called without explicit type argument in a `.then()` chain, leaving the callback parameter typed as `{{inferredType}}`. Provide an explicit type argument (e.g. `fetch<User>().then(...)`) or annotate the callback parameter. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"missingTypeArg", []>) {
    const parserServices = ESLintUtils.getParserServices(context, true);
    const program = parserServices.program;
    if (!program) return {};

    const checker = program.getTypeChecker();

    return {
      CallExpression(node) {
        // Must be a member expression call (e.g. something.then(...))
        if (node.callee.type !== "MemberExpression") return;

        const memberCallee = node.callee;

        // The object being called on must itself be a CallExpression
        // (i.e. a chained call like fetch().then(...))
        if (memberCallee.object.type !== "CallExpression") return;

        const innerCall = memberCallee.object;

        // Must be a .then() call
        const methodName =
          memberCallee.property.type === "Identifier"
            ? memberCallee.property.name
            : null;
        if (methodName !== "then") return;

        // Check return type of inner call — must be a Promise-like type (has `.then`)
        const innerReturnType = parserServices.getTypeAtLocation(innerCall);
        const thenProp = checker.getPropertyOfType(innerReturnType, "then");
        const thenType = thenProp ? checker.getTypeOfSymbol(thenProp) : undefined;
        if (
          !thenType ||
          !thenType
            .getCallSignatures()
            .some((sig) => {
              const decl = sig.getDeclaration();
              return decl && decl.name?.getText() === "then";
            })
        )
          return;

        // Check if the inner call's callee refers to a generic function
        const innerCalleeType = parserServices.getTypeAtLocation(
          innerCall.callee,
        );
        const callSignatures = innerCalleeType.getCallSignatures();
        const hasGenericTypeParams = callSignatures.some((sig) => {
          const decl = sig.getDeclaration();
          return (decl?.typeParameters?.length ?? 0) > 0;
        });
        if (!hasGenericTypeParams) return;

        // The inner call must NOT have explicit type arguments
        if (innerCall.typeArguments) return;

        // Check the .then() callback parameters
        const callback = node.arguments[0];
        if (!callback) return;

        // The callback should be an arrow function or function expression
        if (
          callback.type !== "ArrowFunctionExpression" &&
          callback.type !== "FunctionExpression"
        )
          return;

        // Check each parameter for missing type annotation and `any`/`unknown` type
        let reportedType = "";
        const hasUninferredParam = callback.params.some((param) => {
          // Parameter must not have an explicit type annotation
          if ("typeAnnotation" in param && param.typeAnnotation) return false;

          const paramType = parserServices.getTypeAtLocation(param);

          // Check for both `any` and `unknown` (strict mode infers unknown)
          if (
            paramType.flags === ts.TypeFlags.Any ||
            paramType.flags === ts.TypeFlags.Unknown
          ) {
            reportedType =
              paramType.flags === ts.TypeFlags.Any ? "any" : "unknown";
            return true;
          }
          return false;
        });

        if (hasUninferredParam) {
          context.report({
            node,
            messageId: "missingTypeArg",
            data: { url: DOC_URL, inferredType: reportedType },
          });
        }
      },
    };
  },
});
