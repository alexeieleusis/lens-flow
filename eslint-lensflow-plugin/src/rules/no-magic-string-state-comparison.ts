import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

function isThisMemberExpression(node: unknown): node is { object: { type: "ThisExpression" }; property: { type: "Identifier"; name: string } } {
  if (
    node &&
    typeof node === "object" &&
    "type" in node &&
    node.type === "MemberExpression"
  ) {
    const member = node as unknown as { object: unknown; property: unknown };
    if (
      member.object &&
      typeof member.object === "object" &&
      "type" in member.object &&
      member.object.type === "ThisExpression" &&
      member.property &&
      typeof member.property === "object" &&
      "type" in member.property &&
      member.property.type === "Identifier"
    ) {
      return true;
    }
  }
  return false;
}

function getThisPropertyName(node: { object: { type: string }; property: { type: string; name: string } }): string | null {
  if (node.property.type === "Identifier") {
    return node.property.name;
  }
  return null;
}

function shouldSkipNodeKey(key: string): boolean {
  return key === "parent" || key === "loc" || key === "range";
}

function checkArrayItems(child: unknown[], check: (n: unknown) => boolean): boolean {
  for (const item of child) {
    if (check(item)) return true;
  }
  return false;
}

function checkObjectChild(child: unknown, check: (n: unknown) => boolean): boolean {
  if (!child || typeof child !== "object") return false;
  return check(child);
}

function traverseChildren(node: Record<string, unknown>, check: (n: unknown) => boolean): boolean {
  for (const key of Object.keys(node)) {
    if (shouldSkipNodeKey(key)) continue;
    const child = node[key];
    if (Array.isArray(child)) {
      if (checkArrayItems(child, check)) return true;
    } else if (checkObjectChild(child, check)) {
      return true;
    }
  }
  return false;
}

function isStateAssignmentMatch(node: { type: string }, propName: string): boolean {
  if (node.type !== "AssignmentExpression") return false;
  const assign = node as unknown as { left: unknown };
  if (!isThisMemberExpression(assign.left)) return false;
  const assignedProp = getThisPropertyName(assign.left as { object: { type: string }; property: { type: string; name: string } });
  return assignedProp === propName;
}

function findAssignmentInConsequent(consequent: unknown, propName: string): boolean {
  if (!consequent || typeof consequent !== "object" || !("type" in consequent)) return false;

  const body = (consequent as { body?: unknown[] }).body;
  if (!Array.isArray(body)) return false;

  const visited = new Set<unknown>();

  function checkNode(node: unknown): boolean {
    if (!node || typeof node !== "object") return false;
    if (visited.has(node)) return false;
    visited.add(node);

    if (!("type" in node)) return false;
    if (isStateAssignmentMatch(node as { type: string }, propName)) return true;
    return traverseChildren(node as Record<string, unknown>, checkNode);
  }

  for (const stmt of body) {
    if (checkNode(stmt)) return true;
  }
  return false;
}

export default createRule({
  name: "no-magic-string-state-comparison",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallows comparing a state property against a magic string literal to gate a state transition — use typestate to make invalid transitions a compile error instead",
    },
    messages: {
      magicStringStateComparison:
        "Comparing this.{{prop}} against a magic string literal (\"{{value}}\") to gate a state transition. Use typestate to encode valid transitions at the type level. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T57-typestate.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"magicStringStateComparison", []>) {
    return {
      "MethodDefinition IfStatement"(node) {
        const ifNode = node as unknown as { test: unknown };
        const test = ifNode.test;

        if (
          !test ||
          typeof test !== "object" ||
          (test as { type: unknown }).type !== "BinaryExpression"
        )
          return;

        const bin = test as unknown as { left: unknown; right: unknown; operator: string };
        if (bin.operator !== "==" && bin.operator !== "===") return;

        const { left, right } = bin;

        let propName: string | null = null;
        let stringValue: string | null = null;

        if (isThisMemberExpression(left)) {
          propName = getThisPropertyName(left as { object: { type: string }; property: { type: string; name: string } });
          if (
            right &&
            typeof right === "object" &&
            "type" in right &&
            right.type === "Literal" &&
           typeof (right as unknown as { value: unknown }).value === "string"
           ) {
            stringValue = (right as unknown as { value: string }).value;
          }
        } else if (isThisMemberExpression(right)) {
          propName = getThisPropertyName(right as { object: { type: string }; property: { type: string; name: string } });
          if (
            left &&
            typeof left === "object" &&
            "type" in left &&
            left.type === "Literal" &&
           typeof (left as unknown as { value: unknown }).value === "string"
           ) {
            stringValue = (left as unknown as { value: string }).value;
          }
        }

        if (propName === null || stringValue === null) return;

        if (findAssignmentInConsequent((node as unknown as { consequent: unknown }).consequent, propName)) {
          context.report({
            node,
            messageId: "magicStringStateComparison",
            data: { prop: propName, value: stringValue },
          });
        }
      },
    };
  },
});
