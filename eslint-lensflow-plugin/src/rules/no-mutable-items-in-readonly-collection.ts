import ts from "typescript";
import { ESLintUtils, TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("usecases/UC06-immutability.md");

function isDeclarationMutable(decl: ts.Node): boolean {
  if (decl.kind === ts.SyntaxKind.SetAccessor) {
    return true;
  }
  if (
    decl.kind === ts.SyntaxKind.MethodSignature ||
    decl.kind === ts.SyntaxKind.MethodDeclaration
  ) {
    return true;
  }
  if (
    decl.kind === ts.SyntaxKind.PropertySignature ||
    decl.kind === ts.SyntaxKind.PropertyDeclaration
  ) {
    const modifiers = ts.getModifiers(decl as ts.HasModifiers);
    return !modifiers?.some(
      (m) => m.kind === ts.SyntaxKind.ReadonlyKeyword,
    );
  }
  return false;
}

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
      if (isDeclarationMutable(decl)) {
        return true;
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
        "The type '{{typeName}}' inside this readonly collection contains mutable members (writable properties or methods). Use a fully immutable inner type. See: {{url}}",
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
              url: URL,
            },
          });
        }
      },

      TSTypeOperator(node: TSESTree.TSTypeOperator) {
        if (node.operator !== "readonly") return;
        if (node.typeAnnotation?.type !== TSESTree.AST_NODE_TYPES.TSArrayType) return;

        const innerTypeNode = node.typeAnnotation.elementType;
        const innerTsType = parserServices.getTypeAtLocation(innerTypeNode);

        if (!innerTsType) return;

        if (hasMutableMembers(innerTsType)) {
          context.report({
            node,
            messageId: "mutableInnerType",
            data: {
              typeName: innerTsType.symbol?.name ?? "unknown",
              url: URL,
            },
          });
        }
      },
    };
  },
});
