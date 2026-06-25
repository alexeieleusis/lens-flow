import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

type TypeNode = TSESTree.TypeNode;

function findSelfReferences(
  node: TypeNode,
  aliasName: string,
): TSESTree.TSTypeReference[] {
  const results: TSESTree.TSTypeReference[] = [];

  function walk(n: TypeNode | undefined): void {
    if (!n) return;

    if (n.type === "TSTypeReference") {
      const typeName = n.typeName;
      if (typeName.type === "Identifier" && typeName.name === aliasName) {
        results.push(n);
      }
    }

    switch (n.type) {
      case "TSConditionalType":
        walk(n.checkType);
        walk(n.extendsType);
        walk(n.trueType);
        walk(n.falseType);
        break;
      case "TSUnionType":
        n.types.forEach(walk);
        break;
      case "TSIntersectionType":
        n.types.forEach(walk);
        break;
      case "TSTypeReference":
        if (n.typeArguments?.params) {
          n.typeArguments.params.forEach(walk);
        }
        break;
      case "TSArrayType":
        walk(n.elementType);
        break;
      case "TSTupleType":
        n.elementTypes.forEach(walk);
        break;
      case "TSMappedType":
        walk(n.constraint);
        walk(n.typeAnnotation);
        if (n.nameType) walk(n.nameType);
        break;
      case "TSIndexedAccessType":
        walk(n.objectType);
        walk(n.indexType);
        break;
      case "TSTemplateLiteralType":
        n.types.forEach(walk);
        break;
      case "TSRestType":
      case "TSOptionalType":
        walk(n.typeAnnotation);
        break;
      case "TSTypeOperator":
        walk(n.typeAnnotation);
        break;
    }

    if ((n as any).type === "TSParenthesizedType") {
      walk((n as any).typeAnnotation);
    }
  }

  walk(node);
  return results;
}

function collectInferNames(node: TypeNode): Set<string> {
  const names = new Set<string>();

  function walk(n: TypeNode | undefined): void {
    if (!n) return;

    if (n.type === "TSInferType") {
      names.add(n.typeParameter.name.name);
    }

    switch (n.type) {
      case "TSTypeReference":
        if (n.typeArguments?.params) {
          n.typeArguments.params.forEach(walk);
        }
        break;
      case "TSArrayType":
        walk(n.elementType);
        break;
      case "TSUnionType":
        n.types.forEach(walk);
        break;
      case "TSTupleType":
        n.elementTypes.forEach(walk);
        break;
      case "TSRestType":
      case "TSOptionalType":
        walk(n.typeAnnotation);
        break;
      case "TSTypeOperator":
        walk(n.typeAnnotation);
        break;
    }

    if ((n as any).type === "TSParenthesizedType") {
      walk((n as any).typeAnnotation);
    }
  }

  walk(node);
  return names;
}

function hasStructuralReduction(
  typeParam: TypeNode,
  genericParams: string[],
  inferNames: Set<string>,
): boolean {
  let current: TypeNode = typeParam;

  while ((current as any).type === "TSParenthesizedType") {
    current = (current as any).typeAnnotation;
  }

  if (current.type === "TSInferType") return true;

  if (current.type === "TSTypeReference") {
    const name = current.typeName;
    if (name.type === "Identifier") {
      if (inferNames.has(name.name)) return true;
      if (genericParams.includes(name.name)) return false;
    }
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
        "Recursive type '{{name}}' references itself without structurally reducing the input type parameter, risking excessive depth errors. Use an 'infer' clause to narrow the recursive argument. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T61-recursive-types.md",
      noTerminatingBranch:
        "Recursive type '{{name}}' has self-references in both the true and false branches of a conditional type, meaning no branch terminates the recursion. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T61-recursive-types.md",
    },
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
            data: { name: aliasName },
          });
        } else if (isNonReducing) {
          context.report({
            node,
            messageId: "noStructuralReduction",
            data: { name: aliasName },
          });
        }
      },
    };
  },
});
