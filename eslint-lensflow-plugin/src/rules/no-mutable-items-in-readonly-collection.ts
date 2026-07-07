import ts from "typescript";
import { ESLintUtils, TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

function hasMutableMembers(type: ts.Type): boolean {
  if (type.isUnion()) {
    return type.types.some(hasMutableMembers);
  }
  if (type.isIntersection()) {
    return type.types.some(hasMutableMembers);
  }

  const members = type.getProperties();
  for (const member of members) {
    const decls = member.getDeclarations();
    if (!decls) continue;
    for (const decl of decls) {
      if (
        decl.kind === ts.SyntaxKind.MethodSignature ||
        decl.kind === ts.SyntaxKind.MethodDeclaration
      ) {
        return true;
      }
      if (decl.kind === ts.SyntaxKind.PropertySignature) {
        const modifiers = ts.getModifiers(decl as ts.HasModifiers);
        const isReadonly = modifiers?.some(
          (m) => m.kind === ts.SyntaxKind.ReadonlyKeyword,
        );
        if (!isReadonly) {
          return true;
        }
      }
    }
  }

  return false;
}

export default createRule({
  name: "no-mutable-items-in-readonly-collection",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow ReadonlyArray<T> or Readonly<T> wrapping a mutable type T that contains writable properties or methods, which defeats the immutability guarantee.",
     },
    messages: {
      mutableInnerType:
        "The type '{{typeName}}' inside this readonly collection contains mutable members (writable properties or methods). Use a fully immutable inner type. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC06-immutability.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"mutableInnerType", []>) {
    const parserServices = ESLintUtils.getParserServices(context);
    if (!parserServices.program) return {};

    return {
      TSTypeReference(node: TSESTree.TSTypeReference) {
        if (node.typeName.type !== TSESTree.AST_NODE_TYPES.Identifier) return;

        const name = node.typeName.name;
        if (name !== "ReadonlyArray" && name !== "Readonly") return;

        if (!node.typeArguments || node.typeArguments.params.length === 0) return;

        const innerTypeNode = node.typeArguments.params[0];
        const innerTsType = parserServices.getTypeAtLocation(innerTypeNode);

        if (!innerTsType) return;

        if (hasMutableMembers(innerTsType)) {
          context.report({
            node,
            messageId: "mutableInnerType",
            data: {
              typeName: innerTsType.symbol?.name ?? "unknown",
            },
          });
        }
      },

      TSTypeOperator(node: TSESTree.TSTypeOperator) {
        if (node.operator !== "readonly") return;
        if (node.typeAnnotation.type !== TSESTree.AST_NODE_TYPES.TSArrayType) return;

        const innerTypeNode = node.typeAnnotation.elementType;
        const innerTsType = parserServices.getTypeAtLocation(innerTypeNode);

        if (!innerTsType) return;

        if (hasMutableMembers(innerTsType)) {
          context.report({
            node,
            messageId: "mutableInnerType",
            data: {
              typeName: innerTsType.symbol?.name ?? "unknown",
            },
          });
        }
      },
    };
  },
});
