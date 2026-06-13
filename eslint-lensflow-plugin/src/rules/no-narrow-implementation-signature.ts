import ts from "typescript";
import { ESLintUtils, type TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import type { FnLikeNode } from "../utils/overload-grouping.js";
import { createOverloadGroupVisitor } from "../utils/overload-grouping.js";

const URL =
  "https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T22-callable-typing.md";

function getFnName(node: FnLikeNode): string | null {
  if (node.id?.type === "Identifier") {
    return node.id.name;
  }
  return null;
}

function getTypedParam(
  param: TSESTree.Parameter,
): { identifier: TSESTree.Identifier; typeNode: TSESTree.TypeNode } | null {
  if (
    "typeAnnotation" in param &&
    param.typeAnnotation?.typeAnnotation
  ) {
    if (param.type === "Identifier") {
      return { identifier: param, typeNode: param.typeAnnotation.typeAnnotation };
    }
    return {
      identifier: param as unknown as TSESTree.Identifier,
      typeNode: param.typeAnnotation.typeAnnotation,
    };
  }
  return null;
}

function getParamTypeNode(
  node: FnLikeNode,
  index: number,
): TSESTree.TypeNode | null {
  const info = getTypedParam(node.params[index]);
  return info ? info.typeNode : null;
}

function getParamIdentifier(
  node: FnLikeNode,
  index: number,
): TSESTree.Identifier | null {
  const param = node.params[index];
  if (!param) return null;
  if (param.type === "Identifier") return param;
  return null;
}

function getReturnTypeNode(node: FnLikeNode): TSESTree.TypeNode | null {
  if (node.returnType?.typeAnnotation) {
    return node.returnType.typeAnnotation;
  }
  return null;
}

function isParamTypeNarrow(
  impl: FnLikeNode,
  overload: FnLikeNode,
  index: number,
  checker: ts.TypeChecker,
  esTreeNodeToTSNodeMap: { get: (node: TSESTree.Node) => ts.Node | undefined },
): boolean {
  const overloadTyped = getTypedParam(overload.params[index]);
  const overloadParamType = overloadTyped
    ? checker.getTypeFromTypeNode(
        esTreeNodeToTSNodeMap.get(overloadTyped.typeNode) as ts.TypeNode,
      )
    : checker.getUnknownType();

  const implTyped = getTypedParam(impl.params[index]);
  const implParamType = implTyped
    ? checker.getTypeFromTypeNode(
        esTreeNodeToTSNodeMap.get(implTyped.typeNode) as ts.TypeNode,
      )
    : (() => {
        const implParamId = getParamIdentifier(impl, index);
        if (!implParamId) return checker.getAnyType();
        const tsParam = esTreeNodeToTSNodeMap.get(
          implParamId,
        ) as ts.Identifier;
        return checker.getTypeAtLocation(tsParam);
      })();

  return !checker.isTypeAssignableTo(overloadParamType, implParamType);
}

function checkParamsCompatibility(
  impl: FnLikeNode,
  overload: FnLikeNode,
  checker: ts.TypeChecker,
  esTreeNodeToTSNodeMap: { get: (node: TSESTree.Node) => ts.Node | undefined },
): boolean {
  const maxParams = Math.max(impl.params.length, overload.params.length);

  for (let k = 0; k < maxParams; k++) {
    if (k >= overload.params.length || k >= impl.params.length) {
      return true;
    }
    if (isParamTypeNarrow(impl, overload, k, checker, esTreeNodeToTSNodeMap)) {
      return true;
    }
  }
  return false;
}

function checkReturnTypeCompatibility(
  impl: FnLikeNode,
  overload: FnLikeNode,
  tsImplNode: ts.FunctionDeclaration,
  checker: ts.TypeChecker,
  esTreeNodeToTSNodeMap: { get: (node: TSESTree.Node) => ts.Node | undefined },
): boolean {
  const overloadRetTypeNode = getReturnTypeNode(overload);
  if (!overloadRetTypeNode) return false;

  const overloadRetType = checker.getTypeFromTypeNode(
    esTreeNodeToTSNodeMap.get(overloadRetTypeNode) as ts.TypeNode,
  );

  const implRetTypeNode = getReturnTypeNode(impl);
  if (implRetTypeNode) {
    const implRetType = checker.getTypeFromTypeNode(
      esTreeNodeToTSNodeMap.get(implRetTypeNode) as ts.TypeNode,
    );
    return !checker.isTypeAssignableTo(overloadRetType, implRetType);
  }

  const inferredRetType = checker.getReturnTypeOfSignature(
    checker.getTypeAtLocation(tsImplNode).getCallSignatures()[0],
  );
  return !checker.isTypeAssignableTo(overloadRetType, inferredRetType);
}

function hasNarrowImplementation(
  impl: FnLikeNode,
  overloads: FnLikeNode[],
  checker: ts.TypeChecker,
  esTreeNodeToTSNodeMap: { get: (node: TSESTree.Node) => ts.Node | undefined },
  tsImplNode: ts.FunctionDeclaration,
): boolean {
  for (const overload of overloads) {
    if (checkParamsCompatibility(impl, overload, checker, esTreeNodeToTSNodeMap)) {
      return true;
    }
    if (checkReturnTypeCompatibility(impl, overload, tsImplNode, checker, esTreeNodeToTSNodeMap)) {
      return true;
    }
  }
  return false;
}

export default createRule({
  name: "no-narrow-implementation-signature",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow overload implementation signatures whose parameter or return type is too narrow to be a supertype of all declared overloads.",
      },
    messages: {
      narrowImpl:
        "Implementation signature for `{{fnName}}` is too narrow to cover all overload signatures. The implementation's parameter and return types must be supertypes of the declared overloads. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"narrowImpl", []>) {
    const parserServices = ESLintUtils.getParserServices(context);
    const program = parserServices.program;
    if (!program) return {};

    const checker = program.getTypeChecker();

    const visitor = createOverloadGroupVisitor(({ impl, overloads }) => {
      const fnName = getFnName(impl);
      if (!fnName || overloads.length === 0) return;

      const tsImplNode = parserServices.esTreeNodeToTSNodeMap.get(
        impl,
      ) as ts.FunctionDeclaration;

      if (hasNarrowImplementation(
        impl,
        overloads,
        checker,
        parserServices.esTreeNodeToTSNodeMap,
        tsImplNode,
      )) {
        context.report({
          node: impl,
          messageId: "narrowImpl",
          data: { fnName, url: URL },
        });
      }
    });

    return visitor;
  },
});
