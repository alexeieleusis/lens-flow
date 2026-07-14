import * as ts from "typescript";
import { ESLintUtils, type TSESTree, type TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

interface ESTreeToTSNodeMap {
  get<K extends TSESTree.Node>(key: K): ts.Node | undefined;
}

const URL = knowledgeUrl("catalog/T02-union-intersection.md");

function extractRightmostIdentifier(
  node: TSESTree.Identifier | TSESTree.TSQualifiedName | TSESTree.TSTypeParameter,
): string | null {
  if (node.type === "Identifier") return node.name;
  if (node.type === "TSQualifiedName") return extractRightmostIdentifier(node.right);
  return null;
}

function groupTypeRefs(
  typeRefs: TSESTree.TSTypeReference[],
): Map<string, TSESTree.TSTypeReference[]> {
  const groups = new Map<string, TSESTree.TSTypeReference[]>();
  for (const ref of typeRefs) {
    if (ref.typeName.type === "ThisExpression") continue;
    const baseName = extractRightmostIdentifier(ref.typeName);
    if (!baseName) continue;
    const group = groups.get(baseName) ?? [];
    group.push(ref);
    groups.set(baseName, group);
  }
  return groups;
}

function typesOverlap(typeA: ts.Type, typeB: ts.Type): boolean {
  if ((typeA.flags & ts.TypeFlags.Never) || (typeB.flags & ts.TypeFlags.Never)) {
    return false;
  }

  if (typeA.flags & ts.TypeFlags.Union) {
    const unionA = typeA as ts.UnionType;
    return unionA.types.some((member) => typesOverlap(member, typeB));
  }
  if (typeB.flags & ts.TypeFlags.Union) {
    const unionB = typeB as ts.UnionType;
    return unionB.types.some((member) => typesOverlap(typeA, member));
  }

  if ((typeA.flags & ts.TypeFlags.StringLiteral) && (typeB.flags & ts.TypeFlags.StringLiteral)) {
    return (typeA as ts.StringLiteralType).value === (typeB as ts.StringLiteralType).value;
  }
  if ((typeA.flags & ts.TypeFlags.NumberLiteral) && (typeB.flags & ts.TypeFlags.NumberLiteral)) {
    return (typeA as ts.NumberLiteralType).value === (typeB as ts.NumberLiteralType).value;
  }
  if ((typeA.flags & ts.TypeFlags.BooleanLiteral) && (typeB.flags & ts.TypeFlags.BooleanLiteral)) {
    return (typeA as ts.LiteralType).value === (typeB as ts.LiteralType).value;
  }

  // Different primitive types don't overlap
  const primitiveFlags = ts.TypeFlags.String | ts.TypeFlags.Number | ts.TypeFlags.Boolean;
  if ((typeA.flags & primitiveFlags) && (typeB.flags & primitiveFlags)) {
    return typeA.flags === typeB.flags;
  }

  return true;
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

  // Get symbol name from either symbol or alias symbol
  const symA = typeA.getSymbol() || typeA.aliasSymbol;
  const symB = typeB.getSymbol() || typeB.aliasSymbol;
  if (!symA || !symB || symA.name !== symB.name) return false;

  // Get type arguments using checker API (works for both built-in and user-defined generics)
  const argsA = checker.getTypeArguments(typeA as ts.TypeReference);
  const argsB = checker.getTypeArguments(typeB as ts.TypeReference);
  if (!argsA || !argsB) return false;
  if (argsA.length !== argsB.length || argsA.length === 0) return false;

  // Check if any corresponding type arguments are incompatible
  for (let i = 0; i < argsA.length; i++) {
    if (!typesOverlap(argsA[i], argsB[i])) {
      return true;
    }
  }
  return false;
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
