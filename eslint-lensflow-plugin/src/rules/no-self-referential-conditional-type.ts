import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { collectChildTypes } from "../utils/ts-helpers.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T45-paramspec-variadic.md");

function getRefName(node: TSESTree.TypeNode): string | null {
  if (node.type !== "TSTypeReference") return null;
  return node.typeName.type === "Identifier" ? node.typeName.name : null;
}

function getTypeArgs(node: TSESTree.TypeNode): TSESTree.TypeNode[] {
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
    if (child.type === "TSConditionalType") continue;
    collectInferNames(child, names);
  }
  return names;
}

function referencesName(node: TSESTree.TypeNode, names: Set<string>): boolean {
  const refName = getRefName(node);
  if (refName && names.has(refName)) return true;

  const children = collectChildTypes(node);
  return children.some((child) => referencesName(child, names));
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
    const hasInferUsage = params.some((p) => referencesName(p, inferNames));
    const hasNonDefaultOriginal = params.some(
      (p) =>
        referencesName(p, typeParamNames) &&
        !referencesName(p, inferNames) &&
        !referencesName(p, defaultParamNames),
    );
    const hasOnlyInfer = !params.some((p) => referencesName(p, typeParamNames));
    if (hasNonDefaultOriginal || (hasInferUsage && hasOnlyInfer)) {
      return true;
    }
  }

  const children = collectChildTypes(type);
  return children.some((child) =>
    hasSelfReferentialCall(
      child,
      aliasName,
      typeParamNames,
      inferNames,
      defaultParamNames,
    ),
  );
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
        "Self-referential conditional type may exceed type instantiation depth on long inputs. Consider accumulating results in an additional type parameter. See: {{url}}",
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
          node.typeParameters.params
            .filter((p) => p.default)
            .map((p) => p.name.name),
        );

        function checkConditionals(
          type: TSESTree.TypeNode,
          inferNames: Set<string> = new Set(),
        ): void {
          if (type.type === "TSConditionalType") {
            const branchInferNames = collectInferNames(
              type.extendsType,
              collectInferNames(type.checkType, inferNames),
            );
            if (
              hasSelfReferentialCall(
                type.trueType,
                aliasName,
                typeParamNames,
                branchInferNames,
                defaultParamNames,
              ) ||
              hasSelfReferentialCall(
                type.falseType,
                aliasName,
                typeParamNames,
                branchInferNames,
                defaultParamNames,
              )
            ) {
              context.report({
                node: type,
                messageId: "selfReferential",
                data: {
                  url: URL,
                },
              });
            }
            checkConditionals(type.trueType, branchInferNames);
            checkConditionals(type.falseType, branchInferNames);
          } else {
            for (const child of collectChildTypes(type)) {
              checkConditionals(child, inferNames);
            }
          }
        }

        checkConditionals(node.typeAnnotation);
      },
    };
  },
});
