import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

type MemberKey = {
  base: string;
  property: string;
};

function getMemberKey(node: TSESTree.MemberExpression): MemberKey | null {
  let base: string | null = null;

  if (node.object.type === "Identifier") {
    base = node.object.name;
  } else if (
    node.object.type === "MemberExpression" &&
    node.object.property.type === "Identifier" &&
    node.object.object.type === "Identifier"
  ) {
    base = `${node.object.object.name}.${node.object.property.name}`;
  }

  if (base === null) return null;

  if (node.property.type !== "Identifier") return null;

  return { base, property: node.property.name };
}

function extractBranchInfo(
  test: TSESTree.Expression,
): { memberKey: MemberKey; literal: string } | null {
  if (
    test.type !== "BinaryExpression" ||
    !["===", "!==", "==", "!="].includes(test.operator)
  ) {
    return null;
  }

  const [left, right] = [test.left, test.right];

  let memberExpr: TSESTree.MemberExpression | null = null;
  let literalNode: TSESTree.Literal | null = null;

  if (left.type === "MemberExpression" && right.type === "Literal" && typeof right.value === "string") {
    memberExpr = left;
    literalNode = right;
  } else if (
    right.type === "MemberExpression" &&
    left.type === "Literal" &&
    typeof left.value === "string"
  ) {
    memberExpr = right;
    literalNode = left;
  }

  if (!memberExpr || !literalNode) return null;

  const memberKey = getMemberKey(memberExpr);
  if (!memberKey) return null;

  return { memberKey, literal: String(literalNode.value) };
}

function collectIfElseIfChain(root: TSESTree.IfStatement): TSESTree.IfStatement[] {
  const chain: TSESTree.IfStatement[] = [root];

  let current: TSESTree.Node | null = root;

  while (current) {
    if (current.type !== "IfStatement") break;

    const alternate: TSESTree.Statement | null = current.alternate;
    if (!alternate) break;

    if (alternate.type === "IfStatement") {
      chain.push(alternate);
      current = alternate;
    } else {
      break;
    }
  }

  return chain;
}

export default createRule({
  name: "no-if-else-state-cascade",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow chains of if/else-if comparing the same member against string literals; prefer a switch with exhaustive matching.",
    },
    messages: {
      stateCascade:
        "Found {{count}} consecutive if/else-if branches comparing {{member}} against string literals. Use a switch statement with exhaustive matching instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC13-state-machines.md",
    },
    schema: [
      {
        type: "object",
        properties: {
          minBranches: {
            type: "number",
            minimum: 2,
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
  },
  defaultOptions: [{ minBranches: 3 }],
  create(context: TSESLint.RuleContext<"stateCascade", [{ minBranches?: number }]>) {
    const { minBranches = 3 } = context.options[0] ?? {};
    const reported = new Set<TSESTree.IfStatement>();

    function checkChain(node: TSESTree.IfStatement) {
      const chain = collectIfElseIfChain(node);

      if (chain.length < minBranches) return;

      const branchInfos: Array<{ memberKey: MemberKey; literal: string }> = [];

      for (const ifNode of chain) {
        const info = extractBranchInfo(ifNode.test);
        if (info) {
          branchInfos.push(info);
        } else {
          branchInfos.length = 0;
        }
      }

      if (branchInfos.length < minBranches) return;

      const memberKeys = new Map<string, number>();
      for (const info of branchInfos) {
        const key = `${info.memberKey.base}.${info.memberKey.property}`;
        memberKeys.set(key, (memberKeys.get(key) ?? 0) + 1);
      }

      for (const [key, count] of memberKeys) {
        if (count >= minBranches) {
          for (const n of chain) {
            reported.add(n);
          }
          context.report({
            node,
            messageId: "stateCascade",
            data: {
              count: String(count),
              member: key,
            },
          });
          return;
        }
      }
    }

    return {
      IfStatement(node) {
        if (reported.has(node)) return;
        checkChain(node);
      },
    };
  },
});
