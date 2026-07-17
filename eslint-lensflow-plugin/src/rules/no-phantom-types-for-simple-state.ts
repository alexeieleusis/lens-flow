import { AST_NODE_TYPES, TSESLint, TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

const PHANTOM_NAMES = new Set([
  "_phantom",
  "_brand",
  "_state",
  "_kind",
  "_type",
  "_tag",
  "_marker",
  "_nil",
  "_void",
]);

function isPhantomPropertyName(name: string): boolean {
  if (PHANTOM_NAMES.has(name)) return true;
  if (name.startsWith("_")) return true;
  return false;
}

function getKeyText(key: TSESTree.PropertyName | TSESTree.PrivateIdentifier): string | null {
  if (key.type === AST_NODE_TYPES.Identifier) return key.name;
  if (key.type === AST_NODE_TYPES.Literal && typeof key.value === "string")
    return key.value;
  return null;
}

function isLiteralType(node: TSESTree.Node): boolean {
  return (
    node.type === AST_NODE_TYPES.TSLiteralType ||
    node.type === AST_NODE_TYPES.TSStringKeyword ||
    node.type === AST_NODE_TYPES.TSNumberKeyword
  );
}

function isLiteralUnion(node: TSESTree.Node): boolean {
  if (node.type !== AST_NODE_TYPES.TSUnionType) return false;
  return node.types.length > 0 && node.types.every(isLiteralType);
}

function findTypeParamNames(node: TSESTree.TSTypeParameterDeclaration): Set<string> {
  const result = new Set<string>();
  for (const p of node.params) {
    result.add(p.name.name);
  }
  return result;
}

function checkConstraintIsLiteralUnion(param: TSESTree.TSTypeParameter): boolean {
  if (!param.constraint) return false;
  return isLiteralUnion(param.constraint);
}

function isTypeRefToParam(node: TSESTree.Node | undefined, paramName: string): boolean {
  if (!node || node.type !== AST_NODE_TYPES.TSTypeReference) return false;
  if (node.typeName.type === AST_NODE_TYPES.Identifier) {
    return node.typeName.name === paramName;
  }
  if (node.typeName.type === AST_NODE_TYPES.TSQualifiedName) {
    return node.typeName.right.name === paramName;
  }
  return false;
}

function getParamNames(params: TSESTree.TSTypeParameter[]): string {
  return params.map((p) => p.name.name).join(", ");
}

export default createRule({
  name: "no-phantom-types-for-simple-state",
  meta: {
    fixable: undefined,
    type: "suggestion",
    docs: {
      description:
        "Disallow phantom types for simple state that could be a plain literal union",
    },
    messages: {
      phantomTypeOveruse:
        "Type '{{name}}<{{params}}>' uses phantom type parameter(s) constrained to literal union(s) for simple state. Use a plain literal union type instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC01-invalid-states.md",
    },
    schema: [],
  },
  defaultOptions: [],
 create(context: TSESLint.RuleContext<"phantomTypeOveruse", []>) {
    function checkDeclaration(
      node: TSESTree.TSTypeAliasDeclaration | TSESTree.TSInterfaceDeclaration
    ) {
      if (!node.typeParameters) return;
      const params = node.typeParameters.params;
      const phantomParams = params.filter((p) =>
        checkConstraintIsLiteralUnion(p)
      );
      if (phantomParams.length === 0) return;

      const paramNameSet = findTypeParamNames(node.typeParameters);

      let members: readonly TSESTree.TypeElement[] | undefined;
      if (node.type === AST_NODE_TYPES.TSInterfaceDeclaration) {
        members = node.body?.body;
      } else if (node.typeAnnotation?.type === AST_NODE_TYPES.TSTypeLiteral) {
        members = node.typeAnnotation.members;
      }
      if (!members || members.length === 0) return;

      const allMembersPhantom = members.every((member) => {
        if (member.type !== AST_NODE_TYPES.TSPropertySignature) return false;
        const keyText = getKeyText(member.key);
        if (!keyText) return false;
        return isPhantomPropertyName(keyText);
      });

      if (!allMembersPhantom) return;

      const hasPhantomTypeRef = members.some((member) => {
        if (member.type !== AST_NODE_TYPES.TSPropertySignature) return false;
        const typeAnn = member.typeAnnotation?.typeAnnotation;
        if (!typeAnn) return false;
        return [...paramNameSet].some((pn) =>
          isTypeRefToParam(typeAnn, pn)
        );
      });

      if (!hasPhantomTypeRef) return;

      context.report({
        node,
        messageId: "phantomTypeOveruse",
        data: {
          name: node.id.name,
          params: getParamNames(phantomParams),
        },
      });
    }

    return {
      TSTypeAliasDeclaration(node) {
        checkDeclaration(node);
      },

      TSInterfaceDeclaration(node) {
        checkDeclaration(node);
      },
    };
  },
});
