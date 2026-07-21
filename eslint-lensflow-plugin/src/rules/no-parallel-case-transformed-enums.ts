import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T63-template-literal-types.md");

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

/**
 * Returns the suffix that matches, or null if none.
 */
function getMatchingSuffix(name: string): string | null {
  const lower = name.toLowerCase();
  for (const s of CASE_SUFFIXES) {
    if (lower.endsWith(s)) return s;
  }
  return null;
}

/**
 * Checks whether two enum names share a common base after stripping the case suffix.
 * E.g., "Direction" and "DirectionUpper" share base "Direction".
 * "Forecast" and "Legacy" do NOT share a base even though "Forecast" ends with "case".
 */
function shareCommonBase(aName: string, bName: string): boolean {
  const aSuffix = getMatchingSuffix(aName);
  const bSuffix = getMatchingSuffix(bName);

  if (!aSuffix && !bSuffix) return false;

  // Determine which name has the suffix and which is the potential base
  let baseName: string;
  let suffixedName: string;
  let suffix: string;

  if (aSuffix && bSuffix) {
    // Both have suffixes — check if they share a base by stripping both
    const aBase = aName.slice(0, -aSuffix.length);
    const bBase = bName.slice(0, -bSuffix.length);
    return aBase.toLowerCase() === bBase.toLowerCase();
  }

  if (aSuffix) {
    suffixedName = aName;
    suffix = aSuffix;
    baseName = bName;
  } else {
    suffixedName = bName;
    suffix = bSuffix!;
    baseName = aName;
  }

  const strippedBase = suffixedName.slice(0, -suffix.length);
  return strippedBase.toLowerCase() === baseName.toLowerCase();
}

function getMemberNames(decl: TSESTree.TSEnumDeclaration): string[] {
  return decl.body.members.map((m: TSESTree.TSEnumMember) =>
    m.id.type === "Identifier" ? m.id.name : String(m.id.value),
  );
}

function membersMatchNormalized(a: string[], b: string[]): boolean {
  return a.every((v, i) => v.toLowerCase() === b[i].toLowerCase());
}

function membersDifferInCasing(a: string[], b: string[]): boolean {
  return a.some((v, i) => v !== b[i]);
}

function isParallelCasePair(aMembers: string[], bMembers: string[]): boolean {
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

  if (!shareCommonBase(aName, bName)) return;

  if (aHasSuffix && bHasSuffix) {
    context.report({
      node: bNode,
      messageId: "parallelCaseEnum",
      data: { source: aName, derived: bName, url: URL },
    });
    return;
  }

  const source = aHasSuffix ? bName : aName;
  const derivedNode = aHasSuffix ? aNode : bNode;
  const derivedName = aHasSuffix ? aName : bName;

  context.report({
    node: derivedNode,
    messageId: "parallelCaseEnum",
    data: { source, derived: derivedName, url: URL },
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
        "Enum '{{derived}}' duplicates members of '{{source}}' with transformed casing. Use template literal intrinsic types (e.g., Uppercase<T>) instead. See: {{url}}",
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

            handleParallelEnumPair(context, a.name, a.node, b.name, b.node);
          }
        }
      },
    };
  },
});
