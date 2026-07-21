import type { TSESTree } from "@typescript-eslint/utils";

export function getMembers(
  node: TSESTree.TSInterfaceBody | TSESTree.TSTypeLiteral,
): TSESTree.TypeElement[] {
  if (node.type === "TSInterfaceBody") {
    return node.body;
  }
  return node.members;
}

/**
 * Counts optional and total TSPropertySignature fields in a list of type elements.
 * Shared by `no-parallel-optional-fields-uc01`.
 */
export function countOptionalFields(members: TSESTree.TypeElement[]): {
  optionalCount: number;
  totalFields: number;
  optionalFields: TSESTree.TSPropertySignature[];
} {
  const optionalFields = members.filter(
    (member): member is TSESTree.TSPropertySignature =>
      member.type === "TSPropertySignature" && member.optional,
  );
  const totalFields = members.filter(
    (member): member is TSESTree.TSPropertySignature =>
      member.type === "TSPropertySignature",
  ).length;

  return { optionalCount: optionalFields.length, totalFields, optionalFields };
}
