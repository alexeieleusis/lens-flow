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

  while (current.type === "TSParenthesizedType") {
    current = (current as TSESTree.TSParenthesizedType).typeAnnotation;
  }

  if (current.type === "TSUnionType") {
    return current;
  }

  if (current.type !== "TSTypeReference") {
    return null;
  }

  // Follow alias chains: type A = B; type B = "x" | "y";
  let visited = new Set<string>();
  let node: TSESTree.TypeNode = current;

  while (node.type === "TSTypeReference") {
    const typeName =
      node.typeName.type === "Identifier"
        ? node.typeName.name
        : node.typeName.type === "TSQualifiedName"
          ? node.typeName.right.name
          : null;

    if (!typeName || !typeAliases.has(typeName)) {
      return null;
    }

    if (visited.has(typeName)) {
      return null;
    }
    visited.add(typeName);

    const aliasType = typeAliases.get(typeName)!;

    if (aliasType.type === "TSUnionType") {
      return aliasType;
    }

    if (aliasType.type === "TSParenthesizedType") {
      node = aliasType.typeAnnotation;
    } else if (aliasType.type === "TSTypeReference") {
      node = aliasType;
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
