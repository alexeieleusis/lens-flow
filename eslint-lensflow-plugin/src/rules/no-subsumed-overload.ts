import { type TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import type { FnLikeNode } from "../utils/overload-grouping.js";
import { createOverloadGroupVisitor } from "../utils/overload-grouping.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const KNOWLEDGE_URL = knowledgeUrl("catalog/T22-callable-typing.md");

function getTypeParamNames(node: FnLikeNode): string[] {
  return (node.typeParameters?.params ?? []).map((tp) => tp.name.name);
}

function getParamTypeAnnotation(
  param: TSESTree.Parameter,
): TSESTree.TypeNode | undefined {
  if (param.type === "AssignmentPattern") {
    return (param.left as TSESTree.Identifier).typeAnnotation
      ?.typeAnnotation;
  }
  if (param.type === "RestElement") {
    return param.typeAnnotation?.typeAnnotation;
  }
  if (param.type === "TSParameterProperty") {
    return getParamTypeAnnotation(param.parameter);
  }
  if (param.type === "Identifier") {
    return param.typeAnnotation?.typeAnnotation;
  }
  return undefined;
}

function checkFunctionTypeForTypeParamRef(
  fn: TSESTree.TSFunctionType,
  typeParamNames: string[],
): boolean {
  const retAnnotation = fn.returnType?.typeAnnotation;
  if (retAnnotation && isTypeParameterRef(retAnnotation, typeParamNames)) {
    return true;
  }
  for (const p of fn.params) {
    const pAnnotation = getParamTypeAnnotation(p);
    if (pAnnotation && isTypeParameterRef(pAnnotation, typeParamNames)) {
      return true;
    }
  }
  return false;
}

function checkTypeLiteralForTypeParamRef(
  node: TSESTree.TSTypeLiteral,
  typeParamNames: string[],
): boolean {
  for (const member of node.members) {
    if (member.type === "TSPropertySignature") {
      const mType = member.typeAnnotation?.typeAnnotation;
      if (mType && isTypeParameterRef(mType, typeParamNames)) {
        return true;
      }
    }
  }
  return false;
}

function isTypeParameterRef(
  typeNode: TSESTree.TypeNode | undefined,
  typeParamNames: string[],
): boolean {
  if (!typeNode) return false;
  if (typeNode.type === "TSTypeReference") {
    const typeName = typeNode.typeName;
    if (typeName.type === "Identifier") {
      return typeParamNames.includes(typeName.name);
    }
    if (typeName.type === "TSQualifiedName") {
      return typeParamNames.includes(typeName.right.name);
    }
  }
  if (typeNode.type === "TSArrayType") {
    return isTypeParameterRef(
      typeNode.elementType,
      typeParamNames,
    );
  }
  if (typeNode.type === "TSUnionType") {
    return typeNode.types.some((t) =>
      isTypeParameterRef(t, typeParamNames),
    );
  }
  if (typeNode.type === "TSIntersectionType") {
    return typeNode.types.some((t) =>
      isTypeParameterRef(t, typeParamNames),
    );
  }
  if (typeNode.type === "TSFunctionType") {
    return checkFunctionTypeForTypeParamRef(typeNode, typeParamNames);
  }
  if (typeNode.type === "TSTypeLiteral") {
    return checkTypeLiteralForTypeParamRef(typeNode, typeParamNames);
  }
  return false;
}

function getParamTypeAnnotations(
  node: FnLikeNode,
): (TSESTree.TypeNode | undefined)[] {
  return node.params.map((p) => getParamTypeAnnotation(p));
}

function getReturnTypeAnnotation(
  node: FnLikeNode,
): TSESTree.TypeNode | undefined {
  return node.returnType?.typeAnnotation;
}

const PRIMITIVE_TYPE_KEYWORDS = new Set([
  "TSNumberKeyword",
  "TSStringKeyword",
  "TSBooleanKeyword",
  "TSVoidKeyword",
  "TSAnyKeyword",
  "TSUnknownKeyword",
  "TSNeverKeyword",
  "TSNullKeyword",
  "TSUndefinedKeyword",
  "TSSymbolKeyword",
]);

function isConcreteAssignableToTypeParam(
  target: TSESTree.TypeNode,
  targetTPNames: string[],
): boolean {
  if (target.type !== "TSTypeReference") return false;
  const tName = target.typeName;
  if (tName.type !== "Identifier") return false;
  return targetTPNames.includes(tName.name);
}

function checkTypeReferenceAssignable(
  a: TSESTree.TSTypeReference,
  b: TSESTree.TSTypeReference,
  aTPNames: string[],
  bTPNames: string[],
): boolean {
  const aName = a.typeName;
  const bName = b.typeName;
  if (aName.type !== "Identifier" || bName.type !== "Identifier") {
    return false;
  }
  const aN = aName.name;
  const bN = bName.name;
  const aIsTP = aTPNames.includes(aN);
  const bIsTP = bTPNames.includes(bN);

  if (aIsTP && bIsTP) {
    return aN === bN;
  }
  if (aIsTP && !bIsTP) {
    return false;
  }
  if (!aIsTP && bIsTP) {
    return true;
  }
  return aN === bN;
}

function checkFunctionTypeAssignable(
  a: TSESTree.TSFunctionType,
  b: TSESTree.TSFunctionType,
  aTPNames: string[],
  bTPNames: string[],
): boolean {
  const aRet = a.returnType?.typeAnnotation;
  const bRet = b.returnType?.typeAnnotation;
  if (!isAssignableTo(aRet, bRet, aTPNames, bTPNames)) return false;

  if (a.params.length !== b.params.length) return false;

  for (let i = 0; i < a.params.length; i++) {
    const aP = getParamTypeAnnotation(a.params[i]);
    const bP = getParamTypeAnnotation(b.params[i]);
    if (!isAssignableTo(aP, bP, aTPNames, bTPNames)) return false;
  }
  return true;
}

function checkUnionTypeAssignable(
  a: TSESTree.TSUnionType,
  b: TSESTree.TSUnionType,
  aTPNames: string[],
  bTPNames: string[],
): boolean {
  const aTypes = a.types;
  const bTypes = b.types;
  if (aTypes.length !== bTypes.length) return false;
  return aTypes.every((at) =>
    bTypes.some((bt) => isAssignableTo(at, bt, aTPNames, bTPNames)),
  );
}

function checkIntersectionTypeAssignable(
  a: TSESTree.TSIntersectionType,
  b: TSESTree.TSIntersectionType,
  aTPNames: string[],
  bTPNames: string[],
): boolean {
  const aTypes = a.types;
  const bTypes = b.types;
  if (aTypes.length !== bTypes.length) return false;
  return aTypes.every((at, i) =>
    isAssignableTo(at, bTypes[i], aTPNames, bTPNames),
  );
}

// Check if type A is assignable to type B considering type parameters.
// A concrete type is assignable to a type parameter (since any value satisfies it).
// Two type params match if they have the same name.
function isAssignableTo(
  a: TSESTree.TypeNode | undefined,
  b: TSESTree.TypeNode | undefined,
  aTPNames: string[],
  bTPNames: string[],
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.type !== b.type) {
    return isConcreteAssignableToTypeParam(b, bTPNames);
  }

  if (PRIMITIVE_TYPE_KEYWORDS.has(a.type)) {
    return true;
  }

  if (a.type === "TSTypeReference") {
    return checkTypeReferenceAssignable(
      a,
      b as TSESTree.TSTypeReference,
      aTPNames,
      bTPNames,
    );
  }

  if (a.type === "TSArrayType") {
    return isAssignableTo(
      a.elementType,
      (b as TSESTree.TSArrayType).elementType,
      aTPNames,
      bTPNames,
    );
  }

  if (a.type === "TSFunctionType") {
    return checkFunctionTypeAssignable(
      a,
      b as TSESTree.TSFunctionType,
      aTPNames,
      bTPNames,
    );
  }

  if (a.type === "TSUnionType") {
    return checkUnionTypeAssignable(
      a,
      b as TSESTree.TSUnionType,
      aTPNames,
      bTPNames,
    );
  }

  if (a.type === "TSIntersectionType") {
    return checkIntersectionTypeAssignable(
      a,
      b as TSESTree.TSIntersectionType,
      aTPNames,
      bTPNames,
    );
  }

  if (a.type === "TSLiteralType") {
    return a.literal.type === (b as TSESTree.TSLiteralType).literal.type;
  }

  return a.type === b.type;
}

function hasExtraUsedTypeParams(
  aTypeParams: string[],
  bTypeParams: string[],
  bRet: TSESTree.TypeNode | undefined,
  bParamAnns: (TSESTree.TypeNode | undefined)[],
): boolean {
  if (bTypeParams.length <= aTypeParams.length) return false;

  const extraBParams = bTypeParams.filter(
    (tp) => !aTypeParams.includes(tp),
  );

  if (extraBParams.length === 0) return false;

  return (
    isTypeParameterRef(bRet, extraBParams) ||
    bParamAnns.some((bp) => isTypeParameterRef(bp, extraBParams))
  );
}

function isParamMoreGeneric(
  aParamAnns: (TSESTree.TypeNode | undefined)[],
  bParamAnns: (TSESTree.TypeNode | undefined)[],
  aTypeParams: string[],
  bTypeParams: string[],
): boolean {
  for (let p = 0; p < aParamAnns.length; p++) {
    const aHasTP = isTypeParameterRef(aParamAnns[p], aTypeParams);
    const bHasTP = isTypeParameterRef(bParamAnns[p], bTypeParams);
    if (bHasTP && !aHasTP) {
      return true;
    }
  }
  return false;
}

function allParamsAssignable(
  aParamAnns: (TSESTree.TypeNode | undefined)[],
  bParamAnns: (TSESTree.TypeNode | undefined)[],
  aTypeParams: string[],
  bTypeParams: string[],
): boolean {
  for (let p = 0; p < aParamAnns.length; p++) {
    if (
      !isAssignableTo(
        aParamAnns[p],
        bParamAnns[p],
        aTypeParams,
        bTypeParams,
      )
    ) {
      return false;
    }
  }
  return true;
}

function isOverloadSubsumed(
  aNode: FnLikeNode,
  bNode: FnLikeNode,
): boolean {
  const aParamAnns = getParamTypeAnnotations(aNode);
  const bParamAnns = getParamTypeAnnotations(bNode);

  if (aParamAnns.length !== bParamAnns.length) return false;

  const aRet = getReturnTypeAnnotation(aNode);
  const bRet = getReturnTypeAnnotation(bNode);

  const aTypeParams = getTypeParamNames(aNode);
  const bTypeParams = getTypeParamNames(bNode);

  if (!allParamsAssignable(aParamAnns, bParamAnns, aTypeParams, bTypeParams)) {
    return false;
  }

  if (!isAssignableTo(aRet, bRet, aTypeParams, bTypeParams)) {
    return false;
  }

  const aRetHasTP = isTypeParameterRef(aRet, aTypeParams);
  const bRetHasTP = isTypeParameterRef(bRet, bTypeParams);

  if (bRetHasTP && !aRetHasTP) return true;

  if (isParamMoreGeneric(aParamAnns, bParamAnns, aTypeParams, bTypeParams)) {
    return true;
  }

  return hasExtraUsedTypeParams(
    aTypeParams,
    bTypeParams,
    bRet,
    bParamAnns,
  );
}

export default createRule({
  name: "no-subsumed-overload",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow overload signatures that are strict subsets of another overload, making the narrower overload unreachable.",
    },
    messages: {
      subsumed:
        "Overload signature for `{{fnName}}` is subsumed by a broader overload and is therefore unreachable. Remove it or make it more specific. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"subsumed", []>) {
    const reportSubsumed = (node: TSESTree.Node, fnName: string) => {
      context.report({
        node,
        messageId: "subsumed",
        data: { fnName, url: KNOWLEDGE_URL },
      });
    };

    function checkOverloadGroup(
      impl: FnLikeNode,
      overloads: FnLikeNode[],
    ): void {
      if (
        (impl.type !== "FunctionDeclaration" && impl.type !== "TSDeclareFunction") ||
        impl.id?.type !== "Identifier"
      ) {
        return;
      }

      const fnName = impl.id.name;

      if (overloads.length < 2) return;

      for (let oi = 0; oi < overloads.length; oi++) {
        for (let oj = 0; oj < overloads.length; oj++) {
          if (oi === oj) continue;

          if (isOverloadSubsumed(overloads[oi], overloads[oj])) {
            reportSubsumed(overloads[oi], fnName);
            break;
          }
        }
      }
    }

    const visitor = createOverloadGroupVisitor(({ impl, overloads }) => {
      checkOverloadGroup(impl, overloads);
    });

    return visitor;
  },
});
