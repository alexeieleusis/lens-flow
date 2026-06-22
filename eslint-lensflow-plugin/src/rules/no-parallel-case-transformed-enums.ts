import { TSESTree, TSESLint } from '@typescript-eslint/utils';
import { createRule } from "../utils/rule-creator.js";

const CASE_SUFFIXES = [
  "upper",
  "lower",
  "camel",
  "snake",
  "screaming",
  "casing",
  "case",
  "const",
  "str",
];

function hasCaseSuffix(name: string): boolean {
  const lower = name.toLowerCase();
  return CASE_SUFFIXES.some((s) => lower.endsWith(s));
}

function getMemberNames(decl: TSESTree.TSEnumDeclaration): string[] {
  return decl.body.members.map((m: TSESTree.TSEnumMember) =>
    m.id.type === "Identifier" ? m.id.name : String(m.id.value),
  );
}

function membersMatchNormalized(
  a: string[],
  b: string[],
): boolean {
  return a.every((v, i) => v.toLowerCase() === b[i].toLowerCase());
}

function membersDifferInCasing(
  a: string[],
  b: string[],
): boolean {
  return a.some((v, i) => v !== b[i]);
}

function isParallelCasePair(
  aMembers: string[],
  bMembers: string[],
): boolean {
  if (aMembers.length !== bMembers.length) return false;
  if (aMembers.length === 0) return false;
  if (!membersMatchNormalized(aMembers, bMembers)) return false;
  if (!membersDifferInCasing(aMembers, bMembers)) return false;
  return true;
}

function handleParallelEnumPair(
  context: Parameters<ReturnType<typeof createRule>["create"]>[0],
  aName: string,
  aNode: TSESTree.TSEnumDeclaration,
  bName: string,
  bNode: TSESTree.TSEnumDeclaration,
) {
  const aHasSuffix = hasCaseSuffix(aName);
  const bHasSuffix = hasCaseSuffix(bName);

  if (!aHasSuffix && !bHasSuffix) return;

  if (aHasSuffix && bHasSuffix) {
    context.report({
      node: bNode,
      messageId: "parallelCaseEnum",
      data: { source: aName, derived: bName },
    });
    return;
  }

  const source = aHasSuffix ? bName : aName;
  const derivedNode = aHasSuffix ? aNode : bNode;
  const derivedName = aHasSuffix ? aName : bName;

  context.report({
    node: derivedNode,
    messageId: "parallelCaseEnum",
    data: { source, derived: derivedName },
  });
}

export default createRule({
  name: "no-parallel-case-transformed-enums",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Flags TypeScript enums that duplicate another enum's members with different casing",
    },
    messages: {
      parallelCaseEnum:
        "Enum '{{derived}}' duplicates members of '{{source}}' with transformed casing. Use template literal intrinsic types (e.g., Uppercase<T>) instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T63-template-literal-types.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"parallelCaseEnum", []>) {
    const enumDecls: TSESTree.TSEnumDeclaration[] = [];

    return {
      TSEnumDeclaration(node) {
        enumDecls.push(node);
      },

      "Program:exit"() {
        const enums = enumDecls.map((decl) => ({
          node: decl,
          name: decl.id.name,
          members: getMemberNames(decl),
        }));

        for (let i = 0; i < enums.length; i++) {
          for (let j = i + 1; j < enums.length; j++) {
            const a = enums[i];
            const b = enums[j];

            if (!isParallelCasePair(a.members, b.members)) continue;

            handleParallelEnumPair(
              context,
              a.name,
              a.node,
              b.name,
              b.node,
            );
          }
        }
      },
    };
  },
});
