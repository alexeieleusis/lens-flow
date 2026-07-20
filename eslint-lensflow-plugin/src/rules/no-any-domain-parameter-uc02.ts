import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("usecases/UC02-domain-modeling.md");

function findAnyInTypeList(
  types: TSESTree.TypeNode[],
): TSESTree.TSAnyKeyword | null {
  for (const typeNode of types) {
    const found = containsAnyKeyword(typeNode);
    if (found) return found;
  }
  return null;
}

function checkTypeReference(
  node: TSESTree.TSTypeReference,
): TSESTree.TSAnyKeyword | null {
  const name = node.typeName;
  if (
    name.type === "Identifier" &&
    (name.name === "Array" || name.name === "ReadonlyArray")
  ) {
    const typeParams = node.typeArguments?.params;
    if (typeParams) {
      return findAnyInTypeList(typeParams);
    }
  }
  return null;
}

function containsAnyKeyword(node: TSESTree.TypeNode): TSESTree.TSAnyKeyword | null {
  if (node.type === "TSAnyKeyword") return node;
  if (node.type === "TSArrayType") {
    return containsAnyKeyword(node.elementType);
  }
  if (node.type === "TSUnionType") {
    return findAnyInTypeList(node.types);
  }
  if (node.type === "TSIntersectionType") {
    return findAnyInTypeList(node.types);
  }
  if (node.type === "TSTypeReference") {
    return checkTypeReference(node);
  }
  return null;
}

function extractFromTypedNode(
  name: string,
  node: { typeAnnotation?: { typeAnnotation?: TSESTree.TypeNode } },
): { name: string; typeAnnotation: TSESTree.TypeNode } | null {
  const ta = node.typeAnnotation?.typeAnnotation;
  if (!ta) return null;
  return { name, typeAnnotation: ta };
}

function extractFromAssignmentPattern(
  param: TSESTree.AssignmentPattern,
): { name: string; typeAnnotation: TSESTree.TypeNode } | null {
  const left = param.left;
  if (left.type === "Identifier") {
    return extractFromTypedNode(left.name, left);
  }
  if (left.type === "ObjectPattern" || left.type === "ArrayPattern") {
    return extractFromTypedNode("(destructured)", left);
  }
  return null;
}

function extractFromRestElement(
  param: TSESTree.RestElement,
): { name: string; typeAnnotation: TSESTree.TypeNode } | null {
  const arg = param.argument;
  const ta = param.typeAnnotation?.typeAnnotation;
  if (ta) {
    return {
      name: arg.type === "Identifier" ? arg.name : "(destructured)",
      typeAnnotation: ta,
    };
  }
  if (arg.type === "ObjectPattern" || arg.type === "ArrayPattern") {
    return extractFromTypedNode("(destructured)", arg);
  }
  return null;
}

function extractFromPattern(
  param: TSESTree.ObjectPattern | TSESTree.ArrayPattern,
): { name: string; typeAnnotation: TSESTree.TypeNode } | null {
  return extractFromTypedNode("(destructured)", param);
}

function extractTypeInfo(
  param: TSESTree.Parameter,
): { name: string; typeAnnotation: TSESTree.TypeNode } | null {
  if (param.type === "Identifier") {
    return extractFromTypedNode(param.name, param);
  }
  if (param.type === "AssignmentPattern") {
    return extractFromAssignmentPattern(param);
  }
  if (param.type === "RestElement") {
    return extractFromRestElement(param);
  }
  if (param.type === "TSParameterProperty") {
    return extractTypeInfo(param.parameter);
  }
  if (param.type === "ObjectPattern" || param.type === "ArrayPattern") {
    return extractFromPattern(param);
  }
  return null;
}

export default createRule({
  name: "no-any-domain-parameter-uc02",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow function parameters typed as `any` instead of a typed domain shape",
    },
    messages: {
      anyParam:
        "Function parameter '{{name}}' is typed as `any`. Use a typed domain shape instead of `any` to ensure compile-time structure checking. See: {{url}}",
      anyArrayParam:
        "Function parameter '{{name}}' is typed as `any[]`. Use a typed array like `Item[]` instead of `any[]` to ensure compile-time structure checking. See: {{url}}",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"anyParam" | "anyArrayParam", []>) {
    function checkFunctionNode(
      node: { params: TSESTree.Parameter[] },
    ) {
      for (const param of node.params) {
        const info = extractTypeInfo(param);
        if (!info) continue;

        const anyNode = containsAnyKeyword(info.typeAnnotation);
        if (anyNode) {
          const parentType = info.typeAnnotation.type;
          context.report({
            node: anyNode,
            messageId:
              parentType === "TSArrayType" ? "anyArrayParam" : "anyParam",
            data: {
              name: info.name,
              url: URL,
            },
          });
        }
      }
    }

    return {
      FunctionDeclaration: checkFunctionNode,
      FunctionExpression: checkFunctionNode,
      ArrowFunctionExpression: checkFunctionNode,
      TSDeclareFunction: checkFunctionNode,
      TSFunctionType: checkFunctionNode,
      TSMethodSignature: checkFunctionNode,
    };
  },
});
