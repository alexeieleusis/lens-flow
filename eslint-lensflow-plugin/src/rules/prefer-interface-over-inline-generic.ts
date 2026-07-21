import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T36-trait-objects.md");

function typeLiteralContainsRef(
  node: TSESTree.TSTypeLiteral,
  paramName: string,
): boolean {
  return node.members.some((member) => {
    if (member.type === "TSPropertySignature" && member.typeAnnotation) {
      return containsTypeReference(
        member.typeAnnotation.typeAnnotation,
        paramName,
      );
    }
    if (
      member.type === "TSCallSignatureDeclaration" ||
      member.type === "TSConstructSignatureDeclaration"
    ) {
      const ret = member.returnType;
      if (ret) return containsTypeReference(ret.typeAnnotation, paramName);
    }
    return false;
  });
}

function functionTypeContainsRef(
  node: TSESTree.TSFunctionType | TSESTree.TSConstructorType,
  paramName: string,
): boolean {
  if (
    node.returnType &&
    containsTypeReference(node.returnType.typeAnnotation, paramName)
  ) {
    return true;
  }
  if (node.typeParameters) {
    for (const tp of node.typeParameters.params) {
      if (tp.constraint && containsTypeReference(tp.constraint, paramName))
        return true;
    }
  }
  for (const param of node.params) {
    if (
      param.type === "Identifier" &&
      param.typeAnnotation &&
      containsTypeReference(param.typeAnnotation.typeAnnotation, paramName)
    ) {
      return true;
    }
  }
  return false;
}

function containsTypeReference(
  node: TSESTree.TypeNode,
  paramName: string,
): boolean {
  switch (node.type) {
    case "TSTypeReference":
      if (
        node.typeName.type === "Identifier" &&
        node.typeName.name === paramName
      ) {
        return true;
      }
      return false;

    case "TSUnionType":
    case "TSIntersectionType":
      return node.types.some((t) => containsTypeReference(t, paramName));

    case "TSTypeLiteral":
      return typeLiteralContainsRef(node, paramName);

    case "TSFunctionType":
    case "TSConstructorType":
      return functionTypeContainsRef(node, paramName);

    case "TSArrayType":
      return containsTypeReference(node.elementType, paramName);

    case "TSTupleType":
      return node.elementTypes.some((e) => containsTypeReference(e, paramName));

    case "TSIndexedAccessType":
      return (
        containsTypeReference(node.objectType, paramName) ||
        containsTypeReference(node.indexType, paramName)
      );

    case "TSMappedType":
    case "TSTypeOperator":
      if (node.typeAnnotation)
        return containsTypeReference(node.typeAnnotation, paramName);
      return false;

    case "TSConditionalType":
      return (
        containsTypeReference(node.checkType, paramName) ||
        containsTypeReference(node.extendsType, paramName) ||
        containsTypeReference(node.trueType, paramName) ||
        containsTypeReference(node.falseType, paramName)
      );

    case "TSInferType":
      if (node.typeParameter?.constraint) {
        return containsTypeReference(node.typeParameter.constraint, paramName);
      }
      return false;

    case "TSTypeQuery":
      return false;

    case "TSNamedTupleMember": {
      const member = node;
      if (member.elementType) {
        return containsTypeReference(member.elementType, paramName);
      }
      return false;
    }

    default:
      return false;
  }
}

export default createRule({
  name: "prefer-interface-over-inline-generic",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer a named interface parameter over a generic constrained by an inline type literal",
    },
    messages: {
      preferInterface:
        "Generic parameter constrained by inline type literal should be extracted to a named interface. Use a named interface instead of `T extends {{constraintSummary}}`. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"preferInterface", []>) {
    function checkFunctionLike(
      node: {
        typeParameters?: TSESTree.TSTypeParameterDeclaration | null;
        returnType?: TSESTree.TSTypeAnnotation | null;
      },
      reportNode: TSESTree.Node,
    ) {
      const typeParams = node.typeParameters;
      if (!typeParams) return;

      for (const tp of typeParams.params) {
        if (tp.constraint?.type !== "TSTypeLiteral") continue;

        const paramName = tp.name.name;

        const returnTypeAnnotation = node.returnType?.typeAnnotation;

        if (
          returnTypeAnnotation &&
          containsTypeReference(returnTypeAnnotation, paramName)
        ) {
          continue;
        }

        const memberCount = tp.constraint.members.length;
        const constraintSummary =
          memberCount <= 3
            ? "inline type literal"
            : `inline type literal with ${memberCount} members`;

        context.report({
          node: reportNode,
          messageId: "preferInterface",
          data: {
            constraintSummary,
            url: URL,
          },
        });
      }
    }

    function checkFunction(
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression,
    ) {
      checkFunctionLike(node, node);
    }

    function checkTSDeclareFunction(node: TSESTree.TSDeclareFunction) {
      checkFunctionLike(node, node);
    }

    function checkTSFunctionType(node: TSESTree.TSFunctionType) {
      checkFunctionLike(node, node);
    }

    function checkTSMethodSignature(node: TSESTree.TSMethodSignature) {
      checkFunctionLike(node, node);
    }

    function checkTSCallSignatureDeclaration(
      node: TSESTree.TSCallSignatureDeclaration,
    ) {
      checkFunctionLike(node, node);
    }

    return {
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction,
      TSDeclareFunction: checkTSDeclareFunction,
      TSFunctionType: checkTSFunctionType,
      TSMethodSignature: checkTSMethodSignature,
      TSCallSignatureDeclaration: checkTSCallSignatureDeclaration,
    };
  },
});
