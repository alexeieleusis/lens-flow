import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

export default createRule({
  name: "no-sequential-depth-types",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow copy-pasted sequential depth type aliases that reference each other instead of using a single recursive type",
    },
    messages: {
      sequentialDepthType:
        "Type {{name}} is part of a sequential depth chain ({{chain}}) that should be a single recursive type. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T61-recursive-types.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"sequentialDepthType", []>) {
    const typeAliases: Array<{
      node: TSESTree.TSTypeAliasDeclaration;
      name: string;
      base: string;
      num: number;
    }> = [];

    return {
      "Program:exit"() {
        const groups = new Map<string, typeof typeAliases>();

        for (const alias of typeAliases) {
          if (!groups.has(alias.base)) {
            groups.set(alias.base, []);
          }
          groups.get(alias.base)!.push(alias);
        }

        for (const [, members] of groups) {
          if (members.length < 3) continue;

          members.sort((a, b) => a.num - b.num);

          const chains = findChains(members);

          for (const chain of chains) {
            const chainNames = chain.map((m) => m.name).join(", ");
            for (const member of chain) {
              context.report({
                node: member.node,
                messageId: "sequentialDepthType",
                data: {
                  name: member.name,
                  chain: chainNames,
                },
              });
            }
          }
        }
      },

      TSTypeAliasDeclaration(node) {
        const match = /^(.+?)(\d+)$/.exec(node.id.name);
        if (match) {
          typeAliases.push({
            node,
            name: node.id.name,
            base: match[1],
            num: Number.parseInt(match[2], 10),
          });
        }
      },
    };
  },
});

interface AliasEntry {
  node: TSESTree.TSTypeAliasDeclaration;
  name: string;
  base: string;
  num: number;
}

function findChains(members: AliasEntry[]): AliasEntry[][] {
  const chains: AliasEntry[][] = [];
  let currentChain: AliasEntry[] = [members[0]];

  for (let i = 1; i < members.length; i++) {
    const typeRef = getNextRef(members[i - 1].node);
    if (typeRef === members[i].name) {
      currentChain.push(members[i]);
    } else {
      if (currentChain.length >= 3) {
        chains.push(currentChain);
      }
      currentChain = [members[i]];
    }
  }

  if (currentChain.length >= 3) {
    chains.push(currentChain);
  }

  return chains;
}

function getAllMembers(
  type: TSESTree.TypeNode | null | undefined,
): TSESTree.TSPropertySignature[] {
  const members: TSESTree.TSPropertySignature[] = [];
  for (const literal of unwrapTSTypeLiteral(type)) {
    for (const member of literal.members) {
      if (member.type === "TSPropertySignature") {
        members.push(member);
      }
    }
  }
  return members;
}

function findRefInNodes(type: TSESTree.TypeNode): string | null {
  for (const ref of extractTypeRefs(type)) {
    const name = getRefName(ref.typeName);
    if (name) return name;
  }
  return null;
}

function isKnownArrayLike(name: string | null): boolean {
  return name === "Array" || name === "ReadonlyArray";
}

function checkArrayLike(member: TSESTree.TSPropertySignature): string | null {
  const propType = member.typeAnnotation?.typeAnnotation;
  if (!propType) return null;

  if (propType.type === "TSArrayType") {
    return findRefInNodes(propType.elementType);
  }

  if (propType.type === "TSTypeReference") {
    const baseName = getRefName(propType.typeName);
    if (isKnownArrayLike(baseName) && propType.typeArguments?.params[0]) {
      return findRefInNodes(propType.typeArguments.params[0]);
    }
  }

  return null;
}

function checkPriorityMember(member: TSESTree.TSPropertySignature): string | null {
  return checkArrayLike(member);
}

function checkFallbackMember(member: TSESTree.TSPropertySignature): string | null {
  const propType = member.typeAnnotation?.typeAnnotation;
  if (!propType) return null;
  if (propType.type === "TSArrayType") return null;

  if (propType.type === "TSTypeReference") {
    const baseName = getRefName(propType.typeName);
    if (isKnownArrayLike(baseName)) return null;
  }

  return findRefInNodes(propType);
}

function findFirstRef(
  members: TSESTree.TSPropertySignature[],
  checker: (member: TSESTree.TSPropertySignature) => string | null,
): string | null {
  for (const member of members) {
    const result = checker(member);
    if (result) return result;
  }
  return null;
}

function getNextRef(node: TSESTree.TSTypeAliasDeclaration): string | null {
  const members = getAllMembers(node.typeAnnotation);
  if (members.length === 0) return null;

  const priorityRef = findFirstRef(members, checkPriorityMember);
  if (priorityRef) return priorityRef;

  return findFirstRef(members, checkFallbackMember);
}

function unwrapTSTypeLiteral(
  type: TSESTree.TypeNode | null | undefined,
): TSESTree.TSTypeLiteral[] {
  if (!type) return [];

  if (type.type === "TSTypeLiteral") {
    return [type];
  }

  if (type.type === "TSIntersectionType") {
    const results: TSESTree.TSTypeLiteral[] = [];
    for (const t of type.types) {
      results.push(...unwrapTSTypeLiteral(t));
    }
    return results;
  }

  if (type.type === "TSUnionType") {
    const results: TSESTree.TSTypeLiteral[] = [];
    for (const t of type.types) {
      results.push(...unwrapTSTypeLiteral(t));
    }
    return results;
  }

  {
    const raw = type as unknown as Record<string, unknown>;
    if (raw.type === "TSParenthesizedType") {
      return unwrapTSTypeLiteral(raw.typeAnnotation as TSESTree.TypeNode);
    }
  }

  return [];
}

function extractTypeRefs(type: TSESTree.TypeNode): TSESTree.TSTypeReference[] {
  const results: TSESTree.TSTypeReference[] = [];

  if (type.type === "TSTypeReference") {
    results.push(type);
    return results;
  }

  if (type.type === "TSArrayType") {
    return extractTypeRefs(type.elementType);
  }

  if (type.type === "TSUnionType") {
    for (const unionType of type.types) {
      results.push(...extractTypeRefs(unionType));
    }
    return results;
  }

  if (type.type === "TSIntersectionType") {
    for (const intersectType of type.types) {
      results.push(...extractTypeRefs(intersectType));
    }
    return results;
  }

  if (type.type === "TSTypeOperator" && type.typeAnnotation) {
    return extractTypeRefs(type.typeAnnotation);
  }

  return results;
}

function getRefName(typeName: TSESTree.EntityName): string | null {
  if (typeName.type === "Identifier") {
    if (BUILTIN_TYPES.has(typeName.name)) return null;
    return typeName.name;
  }
  if (typeName.type === "TSQualifiedName") {
    return getRefName(typeName.right);
  }
  return null;
}

const BUILTIN_TYPES = new Set([
  "string",
  "number",
  "boolean",
  "bigint",
  "symbol",
  "null",
  "undefined",
  "void",
  "never",
  "any",
  "unknown",
  "object",
]);
