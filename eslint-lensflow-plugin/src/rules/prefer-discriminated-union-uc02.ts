import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

function isLiteralType(member: TSESTree.TypeNode): boolean {
  return member.type === "TSLiteralType";
}

function countLiteralMembers(union: TSESTree.TSUnionType): number {
  return union.types.filter(isLiteralType).length;
}

function getMembers(
  node: TSESTree.TSInterfaceBody | TSESTree.TSTypeLiteral,
): TSESTree.TypeElement[] {
  if (node.type === "TSInterfaceBody") {
    return node.body;
  }
  return node.members;
}

function resolveUnionNode(
  annotation: TSESTree.TypeNode,
  typeAliases: Map<string, TSESTree.TypeNode>,
): TSESTree.TSUnionType | null {
  if (annotation.type === "TSUnionType") {
    return annotation;
  }

  if (annotation.type !== "TSTypeReference") {
    return null;
  }

  const typeName =
    annotation.typeName.type === "Identifier"
      ? annotation.typeName.name
      : null;

  if (!typeName || !typeAliases.has(typeName)) {
    return null;
  }

  const aliasType = typeAliases.get(typeName)!;
  if (aliasType.type === "TSUnionType") {
    return aliasType;
  }

  return null;
}

function getFieldName(key: TSESTree.PropertyName): string {
  if (key.type === "Identifier") {
    return key.name;
  }

  if (key.type === "Literal") {
    return String(key.value);
  }

  return "?";
}

function reportLiteralUnionField(
  context: TSESLint.RuleContext<string, readonly unknown[]>,
  member: TSESTree.TSPropertySignature,
  unionNode: TSESTree.TSUnionType,
) {
  context.report({
    node: member,
    messageId: "literalUnionField",
    data: {
      field: getFieldName(member.key),
      count: String(countLiteralMembers(unionNode)),
    },
  });
}

export default createRule({
  name: "prefer-discriminated-union-uc02",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer discriminated union over a flat type with a literal-union field",
    },
    messages: {
      literalUnionField:
        "Field '{{field}}' has a union of {{count}} literal types. Consider using a discriminated union for proper narrowing. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/usecases/UC02-domain-modeling.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"literalUnionField", []>) {
    const typeAliases = new Map<string, TSESTree.TypeNode>();

    return {
      TSTypeAliasDeclaration(node: TSESTree.TSTypeAliasDeclaration) {
        typeAliases.set(node.id.name, node.typeAnnotation);
      },

     "TSInterfaceBody, TSTypeLiteral"(
        node: TSESTree.TSInterfaceBody | TSESTree.TSTypeLiteral,
      ) {
        for (const member of getMembers(node)) {
          if (member.type !== "TSPropertySignature") continue;
          if (!member.typeAnnotation) continue;

          const union = resolveUnionNode(
            member.typeAnnotation.typeAnnotation,
            typeAliases,
          );
          if (!union) continue;
          if (countLiteralMembers(union) < 2) continue;

          reportLiteralUnionField(context, member, union);
        }
      },
    };
  },
});
