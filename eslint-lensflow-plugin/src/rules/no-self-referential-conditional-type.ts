import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { collectChildTypes } from "../utils/ts-helpers.js";

function getRefName(
  node: TSESTree.TypeNode,
): string | null {
  if (node.type !== "TSTypeReference") return null;
  return node.typeName.type === "Identifier" ? node.typeName.name : null;
}

function getTypeArgs(
  node: TSESTree.TypeNode,
): TSESTree.TypeNode[] {
  if (node.type === "TSTypeReference" && node.typeArguments) {
    return node.typeArguments.params;
  }
  return [];
}

function collectInferNames(
  type: TSESTree.TypeNode,
  names: Set<string> = new Set(),
): Set<string> {
  if (type.type === "TSInferType") {
    names.add(type.typeParameter.name.name);
  }
  for (const child of collectChildTypes(type)) {
    collectInferNames(child, names);
  }
  return names;
}

function hasSelfReferentialCall(
  type: TSESTree.TypeNode,
  aliasName: string,
  typeParamNames: Set<string>,
  inferNames: Set<string>,
  defaultParamNames: Set<string>,
): boolean {
  const refName = getRefName(type);
  if (refName === aliasName) {
    const params = getTypeArgs(type);
    if (params.length === 0) return false;
    const hasInferUsage = params.some((p) => referencesInferName(p, inferNames));
    const hasNonDefaultOriginal = params.some(
      (p) => referencesOriginalParam(p, typeParamNames) &&
             !referencesInferName(p, inferNames) &&
             !referencesDefaultParam(p, defaultParamNames),
    );
    const hasOnlyInfer = !params.some((p) => referencesOriginalParam(p, typeParamNames));
    if (hasInferUsage && (hasNonDefaultOriginal || hasOnlyInfer)) {
      return true;
    }
    if (hasNonDefaultOriginal) {
      return true;
    }
  }

  const children = collectChildTypes(type);
  return children.some((child) =>
    hasSelfReferentialCall(child, aliasName, typeParamNames, inferNames, defaultParamNames),
  );
}

function referencesOriginalParam(
  node: TSESTree.TypeNode,
  names: Set<string>,
): boolean {
  const refName = getRefName(node);
  if (refName && names.has(refName)) return true;

  const children = collectChildTypes(node);
  return children.some((child) => referencesOriginalParam(child, names));
}

function referencesInferName(
  node: TSESTree.TypeNode,
  names: Set<string>,
): boolean {
  const refName = getRefName(node);
  if (refName && names.has(refName)) return true;

  const children = collectChildTypes(node);
  return children.some((child) => referencesInferName(child, names));
}

function referencesDefaultParam(
  node: TSESTree.TypeNode,
  names: Set<string>,
): boolean {
  const refName = getRefName(node);
  if (refName && names.has(refName)) return true;

  const children = collectChildTypes(node);
  return children.some((child) => referencesDefaultParam(child, names));
}

export default createRule({
  name: "no-self-referential-conditional-type",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow self-referential conditional types that may hit compiler depth limits",
    },
    messages: {
      selfReferential:
        "Self-referential conditional type may exceed type instantiation depth on long inputs. Consider accumulating results in an additional type parameter. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T45-paramspec-variadic.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"selfReferential", []>) {
    return {
      TSTypeAliasDeclaration(node) {
        if (!node.typeParameters) return;

        const aliasName = node.id.name;
        const typeParamNames = new Set(
          node.typeParameters.params.map((p) => p.name.name),
        );
        const defaultParamNames = new Set(
          node.typeParameters.params.filter((p) => p.default).map((p) => p.name.name),
        );

        function checkConditionals(type: TSESTree.TypeNode, inferNames: Set<string> = new Set()): void {
          if (type.type === "TSConditionalType") {
            const branchInferNames = collectInferNames(type.extendsType, collectInferNames(type.checkType, inferNames));
            if (
              hasSelfReferentialCall(type.trueType, aliasName, typeParamNames, branchInferNames, defaultParamNames) ||
              hasSelfReferentialCall(type.falseType, aliasName, typeParamNames, branchInferNames, defaultParamNames)
            ) {
              context.report({
                node: type,
                messageId: "selfReferential",
              });
            }
            checkConditionals(type.trueType, branchInferNames);
            checkConditionals(type.falseType, branchInferNames);
          } else if (
            type.type === "TSUnionType" ||
            type.type === "TSIntersectionType"
          ) {
            type.types.forEach((t) => checkConditionals(t, inferNames));
          } else if (type.type === "TSTupleType") {
            type.elementTypes.forEach((t) => checkConditionals(t, inferNames));
          } else if (type.type === "TSArrayType") {
            checkConditionals(type.elementType, inferNames);
          } else if (type.type === "TSMappedType") {
            if (type.typeAnnotation) checkConditionals(type.typeAnnotation, inferNames);
          } else if (type.type === "TSRestType") {
            checkConditionals(type.typeAnnotation, inferNames);
          }
        }

        checkConditionals(node.typeAnnotation);
      },
    };
  },
});
