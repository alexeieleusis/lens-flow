import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { collectChildTypes } from "../utils/ts-helpers.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T61-recursive-types.md");

type TypeNode = TSESTree.TypeNode;

function findSelfReferences(
  node: TypeNode,
  aliasName: string,
): TSESTree.TSTypeReference[] {
  const results: TSESTree.TSTypeReference[] = [];

  function walk(n: TypeNode): void {
    if (n.type === "TSTypeReference") {
      const typeName = n.typeName;
      if (
        (typeName.type === "Identifier" && typeName.name === aliasName) ||
        (typeName.type === "TSQualifiedName" && typeName.right.name === aliasName)
      ) {
        results.push(n);
      }
    }

    for (const child of collectChildTypes(n)) {
      walk(child);
    }
  }

  walk(node);
  return results;
}

function collectInferNames(node: TypeNode): Set<string> {
  const names = new Set<string>();

  function walk(n: TypeNode): void {
    if (n.type === "TSInferType") {
      names.add(n.typeParameter.name.name);
    }

    for (const child of collectChildTypes(n)) {
      walk(child);
    }
  }

  walk(node);
  return names;
}

function extractIdentName(typeName: TSESTree.EntityName): string | null {
  if (typeName.type === "Identifier") return typeName.name;
  if (typeName.type === "TSQualifiedName") return typeName.right.name;
  return null;
}

function hasCollectionReduction(
  elements: TypeNode[],
  genericParams: string[],
  inferNames: Set<string>,
): boolean {
  for (const element of elements) {
    if (hasStructuralReduction(element, genericParams, inferNames)) return true;
  }
  return false;
}

function hasStructuralReduction(
  typeParam: TypeNode,
  genericParams: string[],
  inferNames: Set<string>,
): boolean {
  let current: TypeNode = typeParam;

  while ((current as unknown as { type: string }).type === "TSParenthesizedType") {
    current = (current as unknown as { typeAnnotation: TypeNode }).typeAnnotation;
  }

  if (current.type === "TSInferType") return true;

  if (current.type === "TSTypeReference") {
    const identName = extractIdentName(current.typeName);
    if (identName && inferNames.has(identName)) return true;
    if (identName && genericParams.includes(identName)) return false;
  }

  if (current.type === "TSIntersectionType") {
    return hasCollectionReduction(current.types, genericParams, inferNames);
  }

  if (current.type === "TSTupleType") {
    return hasCollectionReduction(current.elementTypes, genericParams, inferNames);
  }

  return false;
}

function hasNonReducingSelfRef(
  selfRefs: TSESTree.TSTypeReference[],
  genericParams: string[],
  inferNames: Set<string>,
): boolean {
  for (const ref of selfRefs) {
    if (!ref.typeArguments?.params) return true;
    for (const param of ref.typeArguments.params) {
      if (!hasStructuralReduction(param, genericParams, inferNames)) {
        return true;
      }
    }
  }
  return false;
}

export default createRule({
  name: "no-recursive-type-without-base-case",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow recursive conditional types that lack a structurally reducing base case",
    },
    messages: {
      noStructuralReduction:
        "Recursive type '{{name}}' references itself without structurally reducing the input type parameter, risking excessive depth errors. Use an 'infer' clause to narrow the recursive argument. See: {{url}}",
      noTerminatingBranch:
        "Recursive type '{{name}}' has self-references in both the true and false branches of a conditional type, meaning no branch terminates the recursion. See: {{url}}",
    },
    fixable: undefined,
    schema: [],
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"noTerminatingBranch" | "noStructuralReduction", []>) {
    return {
      TSTypeAliasDeclaration(node) {
        if (node.typeAnnotation.type !== "TSConditionalType") return;

        const aliasName = node.id.name;

        const genericParams = node.typeParameters?.params
          ? node.typeParameters.params.map((p) => p.name.name)
          : [];

        if (genericParams.length === 0) return;

        const selfRefs = findSelfReferences(node.typeAnnotation, aliasName);
        if (selfRefs.length === 0) return;

        const inferNames = collectInferNames(node.typeAnnotation.extendsType);

        const trueSelfRefs = findSelfReferences(
          node.typeAnnotation.trueType,
          aliasName,
        );
        const falseSelfRefs = findSelfReferences(
          node.typeAnnotation.falseType,
          aliasName,
        );

        const bothBranchesRecursive =
          trueSelfRefs.length > 0 && falseSelfRefs.length > 0;

        const isNonReducing = hasNonReducingSelfRef(
          selfRefs,
          genericParams,
          inferNames,
        );

        if (bothBranchesRecursive) {
          context.report({
            node,
            messageId: "noTerminatingBranch",
            data: { name: aliasName, url: URL },
          });
        } else if (isNonReducing) {
          context.report({
            node,
            messageId: "noStructuralReduction",
            data: { name: aliasName, url: URL },
          });
        }
      },
    };
  },
});
