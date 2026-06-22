import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

function getTypeNameString(typeNode: TSESTree.TypeNode): string | null {
  if (typeNode.type === "TSTypeReference") {
    const tn = typeNode.typeName;
    if (tn.type === "Identifier") return tn.name;
    if (
      tn.type === "TSQualifiedName" &&
      tn.right.type === "Identifier"
    )
      return tn.right.name;
  }
  if (typeNode.type === "TSIntersectionType") {
    return typeNode.types
      .map((t) => getTypeNameString(t))
      .filter(Boolean)
      .join(" & ");
  }
  return null;
}

function isSmartConstructor(
  fn:
    | TSESTree.FunctionDeclaration
    | TSESTree.ArrowFunctionExpression
    | TSESTree.FunctionExpression,
  brandedTypeName: string,
): boolean {
  const retType = (fn as TSESTree.FunctionDeclaration).returnType
    ?.typeAnnotation;
  if (!retType) return false;

  if (retType.type === "TSTypeReference") {
    const tn = retType.typeName;
    if (tn.type === "Identifier" && tn.name === brandedTypeName) {
      return true;
    }
  }

  return false;
}

function findEnclosingFunction(
  node: TSESTree.Node,
):
  | TSESTree.FunctionDeclaration
  | TSESTree.ArrowFunctionExpression
  | TSESTree.FunctionExpression
  | null {
  let current: TSESTree.Node | undefined = node;
  while (current) {
    if (
      current.type === "FunctionDeclaration" ||
      current.type === "ArrowFunctionExpression" ||
      current.type === "FunctionExpression"
    ) {
      return current as
        | TSESTree.FunctionDeclaration
        | TSESTree.ArrowFunctionExpression
        | TSESTree.FunctionExpression;
    }
    current = current.parent;
  }
  return null;
}

function getCastTypeName(typeNode: TSESTree.TypeNode): string {
  if (typeNode.type === "TSTypeReference" && typeNode.typeName.type === "Identifier") {
    return typeNode.typeName.name;
  }
  if (
    typeNode.type === "TSTypeReference" &&
    typeNode.typeName.type === "TSQualifiedName"
  ) {
    return typeNode.typeName.right.name;
  }
  if (typeNode.type === "TSIntersectionType") {
    return "(intersection)";
  }
  return "<unknown>";
}

function isRedundantCast(node: TSESTree.TSAsExpression): boolean {
  const parent = node.parent;
  if (parent?.type !== "VariableDeclarator") return false;
  if (parent.id.type !== "Identifier") return false;
  if (!parent.id.typeAnnotation) return false;
  const castName = getTypeNameString(node.typeAnnotation);
  const varName = getTypeNameString(parent.id.typeAnnotation.typeAnnotation);
  return castName !== null && castName === varName;
}

function isBrandedTypePattern(typeNode: TSESTree.TypeNode): boolean {
  if (typeNode.type === "TSIntersectionType") {
    return typeNode.types.length >= 2;
  }

  if (typeNode.type === "TSTypeReference") {
    const typeNameNode = typeNode.typeName;
    if (
      typeNode.typeArguments !== undefined &&
      typeNode.typeArguments.params.length >= 2
    ) {
      return true;
    }
    if (typeNameNode.type === "Identifier") {
      return true;
    }
    if (
      typeNameNode.type === "TSQualifiedName" &&
      typeNameNode.right.type === "Identifier"
    ) {
      return true;
    }
  }

  return false;
}

export default createRule({
  name: "no-scattered-brand-cast",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow scattered `as BrandedType` casts in business logic — use a smart constructor instead.",
    },
    messages: {
      scatteredBrandCast:
        "Scattered branded-type cast `as {{typeName}}` bypasses validation. Use a single smart constructor for all branded values. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T03-newtypes-opaque.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"scatteredBrandCast", []>) {
    return {
      TSAsExpression(node) {
        const castType = node.typeAnnotation;
        if (!isBrandedTypePattern(castType)) return;
        if (isRedundantCast(node)) return;

        const brandedTypeName = getCastTypeName(castType);
        const enclosingFn = findEnclosingFunction(node);

        if (!enclosingFn) {
          context.report({
            node,
            messageId: "scatteredBrandCast",
            data: { typeName: brandedTypeName },
          });
          return;
        }

        if (!isSmartConstructor(enclosingFn, brandedTypeName)) {
          context.report({
            node,
            messageId: "scatteredBrandCast",
            data: { typeName: brandedTypeName },
          });
        }
      },
    };
  },
});
