import ts from "typescript";
import { ESLintUtils, TSESLint, TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

type FunctionLikeNode = TSESTree.FunctionLike
  | TSESTree.TSFunctionType
  | TSESTree.TSMethodSignature;

function unwrapParam(param: TSESTree.Parameter): TSESTree.Parameter {
  if (param.type === "AssignmentPattern") return param.left;
  return param;
}

function getParamName(param: TSESTree.Parameter): string {
  const unwrapped = unwrapParam(param);
  if (unwrapped.type === "Identifier") return unwrapped.name;
  if (unwrapped.type === "TSParameterProperty") return "(modifier-param)";
  return "(parameter)";
  return "(parameter)";
}

function getTypeAnnotation(param: TSESTree.Parameter): TSESTree.TSTypeAnnotation | undefined {
  if (param.type === "TSParameterProperty") return param.parameter.typeAnnotation;
  return param.typeAnnotation;
}

function visitFunction(
  context: TSESLint.RuleContext<"unknownTypePredicate", []>,
  node: FunctionLikeNode,
) {
  const returnAnn = node.returnType?.typeAnnotation;
  if (returnAnn?.type !== "TSTypePredicate") return;

  if (node.params.length === 0) return;

  const firstParam = node.params[0];
  const unwrapped = unwrapParam(firstParam);
  const paramTypeAnn = getTypeAnnotation(unwrapped)?.typeAnnotation;

  const isUnknown = paramTypeAnn?.type === "TSUnknownKeyword";
  const isAny = paramTypeAnn?.type === "TSAnyKeyword";

  if (isUnknown || isAny) {
    context.report({
      node: firstParam,
      messageId: "unknownTypePredicate",
      data: {
        paramName: getParamName(firstParam),
        paramType: isUnknown ? "unknown" : "any",
      },
    });
    return;
  }

  const parserServices = ESLintUtils.getParserServices(context);
  const program = parserServices.program;
  if (!program) return;

  const checker = program.getTypeChecker();
  const tsParam = parserServices.esTreeNodeToTSNodeMap.get(unwrapped);
  if (!tsParam) return;

  const tsType = checker.getTypeAtLocation(tsParam as ts.Node);
  const typeStr = checker.typeToString(tsType);

  if (typeStr === "unknown" || typeStr === "any") {
    context.report({
      node: firstParam,
      messageId: "unknownTypePredicate",
      data: {
        paramName: getParamName(firstParam),
        paramType: typeStr,
      },
    });
  }
}

export default createRule({
  name: "no-unknown-type-predicate",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow type predicate functions with parameters typed as unknown or any, which prevents else-branch narrowing.",
    },
    messages: {
      unknownTypePredicate:
        "Type predicate parameter `{{paramName}}` is typed as `{{paramType}}`, so the else branch will not be narrowed at call sites. Use a union type instead of `{{paramType}}`. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T14-type-narrowing.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"unknownTypePredicate", []>) {
    const handler = (node: FunctionLikeNode) => visitFunction(context, node);

    return {
      FunctionDeclaration: handler,
      FunctionExpression: handler,
      ArrowFunctionExpression: handler,
      TSFunctionType: handler,
      TSEmptyBodyFunctionExpression: handler,
      TSMethodSignature: handler,
      TSDeclareFunction: handler,
      TSAbstractMethodDefinition: (node: TSESTree.TSAbstractMethodDefinition) => visitFunction(context, node.value as TSESTree.FunctionLike),
      MethodDefinition: (node: TSESTree.MethodDefinition) => visitFunction(context, node.value as TSESTree.FunctionLike),
      TSPropertySignature: (node: TSESTree.TSPropertySignature) => {
        if (node.typeAnnotation?.typeAnnotation?.type !== "TSFunctionType" &&
            node.typeAnnotation?.typeAnnotation?.type !== "TSConstructorType") return;
      },
    };
  },
});
