import { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

const URL =
  "https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T03-newtypes-opaque.md";

const ARITHMETIC_OPS = new Set(["+", "-", "*", "/", "%"]);

const NUMBER_PRIMITIVE_TYPES = new Set([
  "TSNumberKeyword",
]);

function isBrandedNumberAnnotation(typeNode: TSESTree.TypeNode): boolean {
  if (typeNode.type !== "TSIntersectionType") return false;

  let hasNumber = false;
  let hasBrand = false;

  for (const member of typeNode.types) {
    if (NUMBER_PRIMITIVE_TYPES.has(member.type as string)) {
      hasNumber = true;
    } else if (
      member.type === "TSTypeLiteral" &&
      member.members.some((m) => {
        if (m.type !== "TSPropertySignature" || !m.key) return false;
        if (m.key.type === "Identifier") {
          const name = m.key.name;
          return (
            name === "_brand" ||
            name === "__brand" ||
            name.endsWith("Brand")
          );
        }
        if (m.key.type === "Literal" && typeof m.key.value === "string") {
          return (
            m.key.value === "_brand" ||
            m.key.value === "__brand" ||
            m.key.value.endsWith("Brand")
          );
        }
        return false;
      })
    ) {
      hasBrand = true;
    }
    // Also handle nested intersections (e.g., type alias reference that expands)
    else if (isBrandedNumberAnnotation(member)) {
      hasNumber = true;
      hasBrand = true;
    }
  }

  return hasNumber && hasBrand;
}

function isBrandedNumberTypeRef(
  typeNode: TSESTree.TypeNode,
  sourceCode: TSESLint.SourceCode,
): boolean {
  if (typeNode.type === "TSTypeReference" && typeNode.typeName.type === "Identifier") {
    const typeName = typeNode.typeName.name;
    // Search for the type alias declaration in the source
    const scope = sourceCode.getScope?.(typeNode);
    if (scope) {
      const variable = scope.set.get(typeName);
      if (variable) {
        for (const def of variable.defs) {
          if (
            def.node.type === "TSModuleDeclaration" ||
            def.node.type === "TSTypeAliasDeclaration"
          ) {
            // Found the type alias - check its type annotation
            const aliasNode = def.node as TSESTree.TSTypeAliasDeclaration;
            if (aliasNode.typeAnnotation) {
              return isBrandedNumberAnnotation(aliasNode.typeAnnotation);
            }
          }
        }
      }
    }
  }
  return false;
}

function isExpressionBrandedNumber(
  node: TSESTree.Expression,
  sourceCode: TSESLint.SourceCode,
): boolean {
  if (node.type !== "Identifier") return false;

  const scope = sourceCode.getScope?.(node);
  if (!scope) return false;

  const variable = scope.set.get(node.name);
  if (!variable) return false;

  for (const def of variable.defs) {
    if (def.node.type === "VariableDeclarator" && def.node.id.typeAnnotation) {
      const typeAnn = def.node.id.typeAnnotation.typeAnnotation;
      // Direct intersection type annotation
      if (isBrandedNumberAnnotation(typeAnn)) return true;
      // Type reference to a branded type
      if (isBrandedNumberTypeRef(typeAnn, sourceCode)) return true;
    }
  }

  return false;
}

function isCastToBrandedNumber(
  node: TSESTree.Node,
  sourceCode: TSESLint.SourceCode,
): boolean {
  if (node.type !== "TSAsExpression" && node.type !== "TSTypeAssertion") return false;

  const typeAnn = (node as TSESTree.TSAsExpression).typeAnnotation;
  if (isBrandedNumberAnnotation(typeAnn)) return true;
  if (isBrandedNumberTypeRef(typeAnn, sourceCode)) return true;
  return false;
}

export default createRule({
  name: "no-branded-number-arithmetic-leak",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow arithmetic operations on branded numbers that silently drop the brand.",
    },
    messages: {
      leak:
        "Arithmetic operation on branded number produces plain `number`, dropping the brand. Re-wrap the result with `as {{brandType}}` or use a dedicated function that preserves the brand. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"leak", []>) {
    const sourceCode = context.sourceCode;

    return {
      BinaryExpression(node) {
        if (!ARITHMETIC_OPS.has(node.operator)) return;

        const leftBranded = isExpressionBrandedNumber(node.left as TSESTree.Expression, sourceCode);
        const rightBranded = isExpressionBrandedNumber(node.right, sourceCode);

        if (!leftBranded && !rightBranded) return;

        const parent = node.parent;
        if (
          (parent?.type === "TSAsExpression" || parent?.type === "TSTypeAssertion") &&
          isCastToBrandedNumber(parent, sourceCode)
        ) {
          return;
        }

        const brandedOperand = leftBranded ? node.left : node.right;
        let brandTypeName = "branded number";
        if (brandedOperand.type === "Identifier") {
          const scope = sourceCode.getScope?.(brandedOperand);
          const variable = scope?.set.get(brandedOperand.name);
          if (variable?.defs[0]?.node.type === "VariableDeclarator" &&
              variable.defs[0].node.id.typeAnnotation) {
            const typeAnn = variable.defs[0].node.id.typeAnnotation.typeAnnotation;
            if (typeAnn.type === "TSTypeReference" &&
                typeAnn.typeName.type === "Identifier") {
              brandTypeName = typeAnn.typeName.name;
            }
          }
        }

        context.report({
          node,
          messageId: "leak",
          data: {
            brandType: brandTypeName,
            url: URL,
          },
        });
      },
    };
  },
});
