import { AST_NODE_TYPES, TSESLint } from "@typescript-eslint/utils";
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

function isLiteralType(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  const n = node as unknown as Record<string, unknown>;
  return (
    n.type === AST_NODE_TYPES.TSLiteralType ||
    n.type === AST_NODE_TYPES.TSStringKeyword ||
    n.type === AST_NODE_TYPES.TSNumberKeyword
  );
}

function isLiteralUnion(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  const n = node as unknown as Record<string, unknown>;
  if (n.type !== AST_NODE_TYPES.TSUnionType) return false;
  const types = n.types as unknown[];
  return types.length > 0 && types.every(isLiteralType);
}

function findTypeParamNames(node: unknown): Set<string> {
  if (!node || typeof node !== "object") return new Set();
  const n = node as unknown as Record<string, unknown>;
  const result = new Set<string>();

  if (n.type === AST_NODE_TYPES.TSTypeParameterDeclaration) {
    const params = n.params as unknown[];
    for (const p of params) {
      const pobj = p as Record<string, unknown>;
      if (pobj.type === AST_NODE_TYPES.TSTypeParameter && pobj.name) {
        const nameNode = pobj.name as unknown as Record<string, unknown>;
        if (nameNode.type === AST_NODE_TYPES.Identifier) {
          result.add((nameNode as Record<string, string>).name);
        }
      }
    }
  }
  return result;
}

function checkConstraintIsLiteralUnion(param: unknown): boolean {
  if (!param || typeof param !== "object") return false;
  const p = param as unknown as Record<string, unknown>;
  const constraint = p.constraint;
  return isLiteralUnion(constraint);
}

function isTypeRefToParam(node: unknown, paramName: string): boolean {
  if (!node || typeof node !== "object") return false;
  const n = node as unknown as Record<string, unknown>;
  if (n.type !== AST_NODE_TYPES.TSTypeReference) return false;
  const typeName = n.typeName as Record<string, unknown>;
  if (typeName?.type === AST_NODE_TYPES.Identifier) {
    return (typeName as Record<string, string>).name === paramName;
  }
  return false;
}

function getParamNames(params: unknown[]): string {
  return params
    .map((p) => {
     const pobj = p as Record<string, unknown>;
      const nameNode = (pobj as unknown as Record<string, unknown>).name as Record<
        string,
        string
      >;
      return nameNode?.name || "?";
    })
    .join(", ");
}

export default createRule({
  name: "no-phantom-types-for-simple-state",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow phantom types for simple state that could be a plain literal union",
    },
    messages: {
      phantomTypeOveruse:
        "Type '{{name}}<{{params}}>' uses phantom type parameter(s) constrained to literal union(s) for simple state. Use a plain literal union type instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/usecases/UC01-invalid-states.md",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"phantomTypeOveruse", []>) {
    function checkDeclaration(
      node:
        | import("@typescript-eslint/types").TSESTree.TSTypeAliasDeclaration
        | import("@typescript-eslint/types").TSESTree.TSInterfaceDeclaration
    ) {
      if (!node.typeParameters) return;
      const params = node.typeParameters.params as unknown[];
      const phantomParams = params.filter((p) => {
     const pobj = p as Record<string, unknown>;
        return (
          pobj.type === AST_NODE_TYPES.TSTypeParameter &&
          checkConstraintIsLiteralUnion(pobj)
        );
      });
      if (phantomParams.length === 0) return;

      const paramNameSet = findTypeParamNames(node.typeParameters);
      const nodeAny = node as unknown as Record<string, unknown>;
      const typeAnnObj = nodeAny.typeAnnotation && typeof nodeAny.typeAnnotation === "object"
        ? nodeAny.typeAnnotation
        : undefined;
      const bodyOrTypeAnn = nodeAny.body && typeof nodeAny.body === "object"
        ? nodeAny.body
        : typeAnnObj;
      const membersArr =
        bodyOrTypeAnn && typeof bodyOrTypeAnn === "object"
          ? ((bodyOrTypeAnn as Record<string, unknown>).body ||
              (bodyOrTypeAnn as Record<string, unknown>).members)
          : undefined;

      const members = membersArr as unknown[] | undefined;
      if (!members || members.length === 0) return;

      const allMembersPhantom = members.every((member) => {
        if (!member || typeof member !== "object") return false;
        const m = member as unknown as Record<string, unknown>;
        if (m.type !== AST_NODE_TYPES.TSPropertySignature) return false;
        const key = m.key as Record<string, unknown>;
        if (key.type !== AST_NODE_TYPES.Identifier) return false;
        return isPhantomPropertyName(
          (key as Record<string, string>).name
        );
      });

      if (!allMembersPhantom) return;

      const hasPhantomTypeRef = members.some((member) => {
        if (!member || typeof member !== "object") return false;
        const m = member as unknown as Record<string, unknown>;
        if (m.type !== AST_NODE_TYPES.TSPropertySignature) return false;
        const typeAnn = m.typeAnnotation as
          | Record<string, unknown>
          | undefined;
        if (!typeAnn?.typeAnnotation) return false;
        return [...paramNameSet].some((pn) =>
          isTypeRefToParam(typeAnn.typeAnnotation, pn)
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
