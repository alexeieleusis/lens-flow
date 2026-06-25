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

function getNextRef(node: TSESTree.TSTypeAliasDeclaration): string | null {
  const typeAnn = node.typeAnnotation;
  if (typeAnn?.type !== "TSTypeLiteral") return null;

  for (const member of typeAnn.members) {
    if (member.type !== "TSPropertySignature") continue;
    const typeAnnotation = member.typeAnnotation?.typeAnnotation;
    if (!typeAnnotation) continue;

    const refs = extractTypeRefs(typeAnnotation);
    for (const ref of refs) {
      const typeName = getRefName(ref.typeName);
      if (typeName) return typeName;
    }
  }
  return null;
}

function extractTypeRefs(type: TSESTree.TypeNode): TSESTree.TSTypeReference[] {
  const results: TSESTree.TSTypeReference[] = [];

  switch (type.type) {
    case "TSTypeReference":
      results.push(type);
      break;
    case "TSArrayType":
      results.push(...extractTypeRefs(type.elementType));
      break;
    case "TSUnionType":
      for (const unionType of type.types) {
        results.push(...extractTypeRefs(unionType));
      }
      break;
    case "TSIntersectionType":
      for (const intersectType of type.types) {
        results.push(...extractTypeRefs(intersectType));
      }
      break;
    case "TSTypeOperator":
      if (type.typeAnnotation) {
        results.push(...extractTypeRefs(type.typeAnnotation));
      }
      break;
  }

  return results;
}

function getRefName(typeName: TSESTree.EntityName): string | null {
  if (typeName.type === "Identifier") {
    if (BUILTIN_TYPES.has(typeName.name)) return null;
    return typeName.name;
  }
  if (typeName.type === "TSQualifiedName") {
    const left = getRefName(typeName.left);
    const right = getRefName(typeName.right);
    return left && right ? `${left}.${right}` : null;
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
