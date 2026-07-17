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
  let current: TSESTree.TypeNode = annotation;

  if (current.type === "TSUnionType") {
    return current;
  }

  if (current.type !== "TSTypeReference") {
    return null;
  }

  // Follow alias chains: type A = B; type B = "x" | "y";
  const visited = new Set<string>();
  let currentNode: TSESTree.TypeNode = current;

  while (currentNode.type === "TSTypeReference") {
    let typeName: string | null;
    if (currentNode.typeName.type === "Identifier") {
      typeName = currentNode.typeName.name;
    } else if (currentNode.typeName.type === "TSQualifiedName") {
      typeName = currentNode.typeName.right.name;
    } else {
      typeName = null;
    }

    if (!typeName || !typeAliases.has(typeName)) {
      return null;
    }

    if (visited.has(typeName)) {
      return null;
    }
    visited.add(typeName);

    const aliasType: TSESTree.TypeNode = typeAliases.get(typeName)!;

    if (aliasType.type === "TSUnionType") {
      return aliasType;
    }

    if (aliasType.type === "TSTypeReference") {
      currentNode = aliasType;
    } else {
      return null;
    }
  }

  return null;
}

function getFieldName(key: TSESTree.PropertyName, sourceCode: TSESLint.SourceCode): string {
  if (key.type === "Identifier") {
    return key.name;
  }

  if (key.type === "Literal") {
    return String(key.value);
  }

  return sourceCode.getText(key);
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
      field: getFieldName(member.key, context.sourceCode),
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
        "Field '{{field}}' has a union of {{count}} literal types. Consider using a discriminated union for proper narrowing. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC02-domain-modeling.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
 create(context: TSESLint.RuleContext<"literalUnionField", []>) {
    const typeAliases = new Map<string, TSESTree.TypeNode>();

    return {
      Program(program: TSESTree.Program) {
        for (const stmt of program.body) {
          if (stmt.type === "TSTypeAliasDeclaration") {
            typeAliases.set(stmt.id.name, stmt.typeAnnotation);
          }
        }
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
