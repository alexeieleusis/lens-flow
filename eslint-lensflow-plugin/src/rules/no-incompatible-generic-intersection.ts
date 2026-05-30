import * as ts from "typescript";
import { ESLintUtils, type TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

interface ESTreeToTSNodeMap {
  get<K extends TSESTree.Node>(key: K): ts.Node | undefined;
}

const URL =
  "https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T02-union-intersection.md";

function getBaseName(
  typeName: TSESTree.Identifier | TSESTree.TSTypeParameter,
): string | null {
  if (typeName.type === "Identifier") return typeName.name;
  return null;
}

function groupTypeRefs(
  typeRefs: TSESTree.TSTypeReference[],
): Map<string, TSESTree.TSTypeReference[]> {
  const groups = new Map<string, TSESTree.TSTypeReference[]>();
  for (const ref of typeRefs) {
    if (ref.typeName.type === "TSQualifiedName" || ref.typeName.type === "ThisExpression") continue;
    const baseName = getBaseName(ref.typeName);
    if (!baseName) continue;
    const group = groups.get(baseName) ?? [];
    group.push(ref);
    groups.set(baseName, group);
  }
  return groups;
}

function checkPairIncompatible(
  checker: ts.TypeChecker,
  nodeMap: ESTreeToTSNodeMap,
  memberA: TSESTree.TSTypeReference,
  memberB: TSESTree.TSTypeReference,
): boolean {
  const tsNodeA = nodeMap.get(memberA);
  const tsNodeB = nodeMap.get(memberB);
  if (!tsNodeA || !tsNodeB) return false;

  const typeA = checker.getTypeFromTypeNode(tsNodeA as ts.TypeNode);
  const typeB = checker.getTypeFromTypeNode(tsNodeB as ts.TypeNode);

  return !checker.isTypeAssignableTo(typeA, typeB)
    && !checker.isTypeAssignableTo(typeB, typeA);
}

function checkGroupForIncompatibility(
  checker: ts.TypeChecker,
  nodeMap: ESTreeToTSNodeMap,
  members: TSESTree.TSTypeReference[],
  node: TSESTree.TSIntersectionType,
  context: Parameters<ReturnType<typeof createRule>["create"]>[0],
) {
  if (members.length < 2) return;

  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      if (checkPairIncompatible(checker, nodeMap, members[i], members[j])) {
        const tsNodeI = nodeMap.get(members[i]) as ts.TypeNode;
        const tsNodeJ = nodeMap.get(members[j]) as ts.TypeNode;
        const typeI = checker.getTypeFromTypeNode(tsNodeI);
        const typeJ = checker.getTypeFromTypeNode(tsNodeJ);

        context.report({
          node,
          messageId: "incompatible",
          data: {
            left: checker.typeToString(typeI),
            right: checker.typeToString(typeJ),
            url: URL,
          },
        });
        return;
      }
    }
  }
}

export default createRule({
  name: "no-incompatible-generic-intersection",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow intersecting generic types with mutually incompatible type parameters, which produce `never`.",
     },
    messages: {
      incompatible:
        "Intersection of '{{left}}' and '{{right}}' produces `never` because no value can satisfy both. Consider using a union (`|`) instead of an intersection (`&`). See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"incompatible", []>) {
    const parserServices = ESLintUtils.getParserServices(context);
    const program = parserServices.program;
    if (!program) return {};

    const checker = program.getTypeChecker();

    return {
      TSIntersectionType(node) {
        const typeRefs = node.types.filter(
          (m): m is TSESTree.TSTypeReference => m.type === "TSTypeReference",
        );

        const groups = groupTypeRefs(typeRefs);
        const nodeMap = parserServices.esTreeNodeToTSNodeMap;

        for (const members of groups.values()) {
          checkGroupForIncompatibility(
            checker,
            nodeMap,
            members,
            node,
            context,
          );
        }
      },
    };
  },
});
