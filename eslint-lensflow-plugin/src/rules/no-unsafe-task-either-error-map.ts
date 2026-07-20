import ts from "typescript";
import { ESLintUtils, TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { walk } from "../utils/ast-helpers.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

interface ESTreeToTSNodeMap {
  get<K extends TSESTree.Node>(key: K): ts.Node | undefined;
}

const DOCS_URL = knowledgeUrl("usecases/UC21-async-concurrency.md");

function isTryCatchCall(
  node: TSESTree.CallExpression,
  knownTENames: Set<string>,
): boolean {
  if (node.callee.type !== "MemberExpression") return false;
  if (node.callee.property.type !== "Identifier") return false;
  if (node.callee.property.name !== "tryCatch") return false;
  if (node.callee.object.type !== "Identifier") return false;
  return knownTENames.has(node.callee.object.name);
}

function getKnownTENames(): Set<string> {
  return new Set(["TE", "TaskEither"]);
}

function resolveErrorTypeFromAnnotation(
  checker: ts.TypeChecker,
  esTreeNodeToTSNodeMap: ESTreeToTSNodeMap,
  returnAnn: TSESTree.TypeNode,
): string | null {
  if (returnAnn.type === "TSTypeReference") {
    const ref = returnAnn;
    const typeParams = ref.typeArguments;
    if (typeParams && typeParams.params.length >= 1) {
      const errorTypeParam = typeParams.params[0];
      const tsNode = esTreeNodeToTSNodeMap.get(errorTypeParam);
      if (tsNode) {
        const resolvedType = checker.getTypeAtLocation(
          tsNode as ts.TypeNode,
        );
        return checker.typeToString(resolvedType);
      }
    }
  }

  if (returnAnn.type === "TSUnionType") {
    for (const member of returnAnn.types) {
      const result = resolveErrorTypeFromAnnotation(
        checker,
        esTreeNodeToTSNodeMap,
        member,
      );
      if (result) return result;
    }
  }

  return null;
}

export default createRule({
  name: "no-unsafe-task-either-error-map",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow throwing generic Error or using unsafe `as` cast in TE.tryCatch when a typed error channel is expected.",
    },
    messages: {
      unsafeThrow:
        "Throwing a generic `Error` instead of a typed error. The declared error channel expects {{expectedType}}. Construct a value of that type instead. See: {{url}}",
      unsafeCast:
        "Using an unsafe `as` cast in the error mapper instead of constructing a typed error directly. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"unsafeThrow" | "unsafeCast", []>) {
    const parserServices = ESLintUtils.getParserServices(context, true);
    const program = parserServices.program;
    if (!program) return {};

    const checker = program.getTypeChecker();
    const esTreeNodeToTSNodeMap = parserServices.esTreeNodeToTSNodeMap;
    const knownTENames = getKnownTENames();

    const fnStack: Array<{ fn: TSESTree.FunctionLike; errorTypeStr: string | null }> = [];

    function resolveErrorType(
      fn: TSESTree.FunctionLike,
    ): string | null {
      const returnAnn = fn.returnType?.typeAnnotation;
      if (!returnAnn) return null;
      return resolveErrorTypeFromAnnotation(
        checker,
        esTreeNodeToTSNodeMap,
        returnAnn,
      );
    }

    return {
      FunctionDeclaration(node) {
        fnStack.push({ fn: node, errorTypeStr: resolveErrorType(node) });
      },
      "FunctionDeclaration:exit"() {
        fnStack.pop();
      },

      FunctionExpression(node) {
        fnStack.push({ fn: node, errorTypeStr: resolveErrorType(node) });
      },
      "FunctionExpression:exit"() {
        fnStack.pop();
      },

      ArrowFunctionExpression(node) {
        fnStack.push({ fn: node, errorTypeStr: resolveErrorType(node) });
      },
      "ArrowFunctionExpression:exit"() {
        fnStack.pop();
      },

      CallExpression(node) {
        if (!isTryCatchCall(node, knownTENames)) return;
        if (node.arguments.length < 2) return;

        const ctx = fnStack[fnStack.length - 1];
        if (!ctx?.errorTypeStr) return;

        const [tryFn, catchFn] = node.arguments;

        // Check ThrowStatements inside the try function body
        if (
          (tryFn.type === "ArrowFunctionExpression" ||
            tryFn.type === "FunctionExpression") &&
          tryFn.body
        ) {
          walk(tryFn.body, (childNode) => {
            if (childNode.type !== "ThrowStatement") return;
            if (!childNode.argument) return;

            const thrownTsNode = esTreeNodeToTSNodeMap.get(
              childNode.argument,
            );
            if (!thrownTsNode) return;

            const thrownType = checker.getTypeAtLocation(
              thrownTsNode as ts.Expression,
            );
            const thrownTypeStr = checker.typeToString(thrownType);

            if (
              (thrownTypeStr === "Error" ||
                thrownTypeStr.startsWith("Error &")) &&
              thrownTypeStr !== ctx.errorTypeStr
            ) {
              context.report({
                node: childNode.argument,
                messageId: "unsafeThrow",
                data: { expectedType: ctx.errorTypeStr, url: DOCS_URL },
              });
            }
          });
        }

        // Check for TSAsExpression in the catch/error mapper function
        if (
          (catchFn.type === "ArrowFunctionExpression" ||
            catchFn.type === "FunctionExpression") &&
          catchFn.body
        ) {
          walk(catchFn.body, (childNode) => {
            if (childNode.type !== "TSAsExpression") return;
            // `as const` is a valid narrowing assertion — do not flag it
            const cast = childNode;
            if (
              cast.typeAnnotation.type === "TSTypeReference" &&
              cast.typeAnnotation.typeName.type === "Identifier" &&
              cast.typeAnnotation.typeName.name === "const"
            ) {
              return;
            }
            context.report({
              node: childNode,
              messageId: "unsafeCast",
              data: { url: DOCS_URL },
            });
          });
        }
      },
    };
  },
});
