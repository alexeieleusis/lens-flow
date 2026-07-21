import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { getChildren } from "../utils/ast-helpers.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T61-recursive-types.md");

function collectTypeRefNames(node: TSESTree.Node, refs: Set<string>): void {
  if (node.type === "TSTypeReference") {
    const ref = node;
    if (ref.typeName.type === "Identifier") {
      refs.add(ref.typeName.name);
    } else if (ref.typeName.type === "TSQualifiedName") {
      refs.add(ref.typeName.right.name);
    }
  }
  for (const child of getChildren(node)) {
    collectTypeRefNames(child, refs);
  }
}

function hasTypeRefToName(
  member: TSESTree.TypeNode,
  name: string,
  typeAliases: Map<string, TSESTree.TypeNode>,
  visited: Set<string> = new Set(),
): boolean {
  const refs = new Set<string>();
  collectTypeRefNames(member, refs);
  if (refs.has(name)) return true;

  const target = member;
  if (target.type === "TSTypeReference") {
    const ref = target;
    let refName: string | null = null;
    if (ref.typeName.type === "Identifier") {
      refName = ref.typeName.name;
    } else if (ref.typeName.type === "TSQualifiedName") {
      refName = ref.typeName.right.name;
    }
    if (refName && typeAliases.has(refName) && !visited.has(refName)) {
      visited.add(refName);
      const resolved = typeAliases.get(refName)!;
      return hasTypeRefToName(resolved, name, typeAliases, visited);
    }
  }
  return false;
}

function findKeywordInMembers(
  types: TSESTree.TypeNode[],
): "any" | "unknown" | null {
  for (const t of types) {
    if (t.type === "TSAnyKeyword") return "any";
    if (t.type === "TSUnknownKeyword") return "unknown";
    if (t.type === "TSUnionType" || t.type === "TSIntersectionType") {
      const found = findKeywordInMembers(t.types);
      if (found) return found;
    }
  }
  return null;
}

function findKeyword(node: TSESTree.TypeNode): "any" | "unknown" | null {
  if (node.type === "TSAnyKeyword") return "any";
  if (node.type === "TSUnknownKeyword") return "unknown";
  if (node.type === "TSUnionType") return findKeywordInMembers(node.types);
  if (node.type === "TSIntersectionType")
    return findKeywordInMembers(node.types);
  return null;
}

function collectAnyPropsFromLiteral(
  literal: TSESTree.TSTypeLiteral,
  anyProps: TSESTree.TSPropertySignature[],
  unknownProps: TSESTree.TSPropertySignature[],
): void {
  for (const m of literal.members) {
    if (m.type === "TSPropertySignature") {
      const prop = m as TSESTree.TSPropertySignature;
      if (prop.typeAnnotation) {
        const kw = findKeyword(prop.typeAnnotation.typeAnnotation);
        if (kw === "any") anyProps.push(prop);
        else if (kw === "unknown") unknownProps.push(prop);
      }
    }
  }
}

function extractRefName(ref: TSESTree.TSTypeReference): string | null {
  if (ref.typeName.type === "Identifier") {
    return ref.typeName.name;
  }
  if (ref.typeName.type === "TSQualifiedName") {
    return ref.typeName.right.name;
  }
  return null;
}

function collectAnyProps(
  member: TSESTree.TypeNode,
  anyProps: TSESTree.TSPropertySignature[],
  unknownProps: TSESTree.TSPropertySignature[],
  typeAliases: Map<string, TSESTree.TypeNode>,
): void {
  if (member.type === "TSTypeLiteral") {
    collectAnyPropsFromLiteral(member, anyProps, unknownProps);
  } else if (member.type === "TSTypeReference") {
    const refName = extractRefName(member);
    if (refName && typeAliases.has(refName)) {
      const resolved = typeAliases.get(refName)!;
      if (resolved.type === "TSTypeLiteral") {
        collectAnyPropsFromLiteral(resolved, anyProps, unknownProps);
      } else if (resolved.type === "TSUnionType") {
        for (const innerMember of resolved.types) {
          collectAnyProps(innerMember, anyProps, unknownProps, typeAliases);
        }
      }
    }
  }
}

function resolveUnionAliasName(node: TSESTree.Node): string | null {
  let current: TSESTree.Node | undefined = (
    node as TSESTree.Node & { parent?: TSESTree.Node }
  ).parent;
  while (current) {
    if (current.type === "TSTypeAliasDeclaration") {
      return current.id.name;
    }
    current = (current as TSESTree.Node & { parent?: TSESTree.Node }).parent;
  }
  return null;
}

export default createRule({
  name: "no-any-in-recursive-union-variant",
  meta: {
    type: "problem",
    fixable: undefined,
    docs: {
      description:
        "Disallow `any` or `unknown` in data fields of recursive discriminated union variants",
    },
    messages: {
      anyOrUnknownInRecursiveVariant:
        "Variant uses `{{keyword}}` in a recursive discriminated union. Use a concrete type for type safety over the entire structure. See: {{url}}",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"anyOrUnknownInRecursiveVariant", []>) {
    const typeAliases = new Map<string, TSESTree.TypeNode>();
    const unionsToCheck: TSESTree.TSUnionType[] = [];

    return {
      TSTypeAliasDeclaration(node) {
        typeAliases.set(node.id.name, node.typeAnnotation);
      },

      TSUnionType(node) {
        unionsToCheck.push(node);
      },

      "Program:exit"() {
        for (const unionNode of unionsToCheck) {
          const unionName = resolveUnionAliasName(unionNode);
          if (!unionName) continue;

          const anyProps: TSESTree.TSPropertySignature[] = [];
          const unknownProps: TSESTree.TSPropertySignature[] = [];

          for (const member of unionNode.types) {
            collectAnyProps(member, anyProps, unknownProps, typeAliases);
          }

          const isRecursive = unionNode.types.some((member) =>
            hasTypeRefToName(member, unionName, typeAliases),
          );

          if (!isRecursive) continue;

          for (const prop of anyProps) {
            context.report({
              node: prop,
              messageId: "anyOrUnknownInRecursiveVariant",
              data: { keyword: "any", url: URL },
            });
          }
          for (const prop of unknownProps) {
            context.report({
              node: prop,
              messageId: "anyOrUnknownInRecursiveVariant",
              data: { keyword: "unknown", url: URL },
            });
          }
        }
      },
    };
  },
});
