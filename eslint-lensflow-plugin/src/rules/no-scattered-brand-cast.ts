import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T03-newtypes-opaque.md");

function getTypeNameString(typeNode: TSESTree.TypeNode): string | null {
  if (typeNode.type === "TSTypeReference") {
    const tn = typeNode.typeName;
    if (tn.type === "Identifier") return tn.name;
    if (tn.type === "TSQualifiedName" && tn.right.type === "Identifier")
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
  context: TSESLint.RuleContext<string, unknown[]>,
  node: TSESTree.Node,
):
  | TSESTree.FunctionDeclaration
  | TSESTree.ArrowFunctionExpression
  | TSESTree.FunctionExpression
  | null {
  const ancestors = context.sourceCode.getAncestors(node);
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const current = ancestors[i];
    if (
      current.type === "FunctionDeclaration" ||
      current.type === "ArrowFunctionExpression" ||
      current.type === "FunctionExpression"
    ) {
      return current;
    }
  }
  return null;
}

function getCastTypeName(typeNode: TSESTree.TypeNode): string {
  if (
    typeNode.type === "TSTypeReference" &&
    typeNode.typeName.type === "Identifier"
  ) {
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

const KNOWN_BRANDED_CONSTRUCTORS = new Set([
  "Branded",
  "Opaque",
  "Nominal",
  "BrandedType",
]);

function isTypeNameBranded(
  name: string,
  knownBrandedTypes: ReadonlySet<string>,
): boolean {
  if (name.endsWith("Brand")) return true;
  if (KNOWN_BRANDED_CONSTRUCTORS.has(name)) return true;
  if (knownBrandedTypes.has(name)) return true;
  return false;
}

function getTypeIdentifier(typeNameNode: TSESTree.EntityName): string | null {
  if (typeNameNode.type === "Identifier") return typeNameNode.name;
  if (
    typeNameNode.type === "TSQualifiedName" &&
    typeNameNode.right.type === "Identifier"
  )
    return typeNameNode.right.name;
  return null;
}

function hasBrandProperty(typeNode: TSESTree.TypeNode): boolean {
  if (typeNode.type !== "TSTypeLiteral") return false;
  for (const member of typeNode.members) {
    if (member.type !== "TSPropertySignature") continue;
    const key = member.key;
    if (key.type === "Identifier") {
      const name = key.name;
      if (name === "_brand" || name === "__brand" || name.endsWith("Brand")) {
        return true;
      }
    }
    if (key.type === "Literal" && typeof key.value === "string") {
      const name = key.value;
      if (name === "_brand" || name === "__brand" || name.endsWith("Brand")) {
        return true;
      }
    }
  }
  return false;
}

function isBrandedTypePattern(
  typeNode: TSESTree.TypeNode,
  knownBrandedTypes: ReadonlySet<string> = new Set(),
): boolean {
  if (typeNode.type === "TSIntersectionType") {
    return typeNode.types.some((member) => {
      if (hasBrandProperty(member)) return true;
      if (member.type === "TSTypeReference") {
        const name = getTypeIdentifier(member.typeName);
        if (name !== null && isTypeNameBranded(name, knownBrandedTypes)) {
          return true;
        }
      }
      return false;
    });
  }

  if (typeNode.type === "TSTypeReference") {
    const name = getTypeIdentifier(typeNode.typeName);
    if (name !== null && isTypeNameBranded(name, knownBrandedTypes)) {
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
        "Scattered branded-type cast `as {{typeName}}` bypasses validation. Use a single smart constructor for all branded values. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"scatteredBrandCast", []>) {
    const knownBrandedTypes = new Set<string>();
    return {
      TSTypeAliasDeclaration(node) {
        if (isBrandedTypePattern(node.typeAnnotation, knownBrandedTypes)) {
          knownBrandedTypes.add(node.id.name);
        }
      },
      TSAsExpression(node) {
        const castType = node.typeAnnotation;
        if (!isBrandedTypePattern(castType, knownBrandedTypes)) return;
        if (isRedundantCast(node)) return;

        const brandedTypeName = getCastTypeName(castType);
        const enclosingFn = findEnclosingFunction(context, node);

        if (!enclosingFn) {
          context.report({
            node,
            messageId: "scatteredBrandCast",
            data: { typeName: brandedTypeName, url: URL },
          });
          return;
        }

        if (!isSmartConstructor(enclosingFn, brandedTypeName)) {
          context.report({
            node,
            messageId: "scatteredBrandCast",
            data: { typeName: brandedTypeName, url: URL },
          });
        }
      },
    };
  },
});
