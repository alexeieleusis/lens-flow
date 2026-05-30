import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

const URL =
  "https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T34-never-bottom.md";

interface TSESTreeWithParent {
  type: string;
  parent?: TSESTreeWithParent;
}

function getBaseIdentifier(node: TSESTree.Node): string | null {
  if (node.type === "Identifier") return node.name;
  if (node.type === "MemberExpression") return getBaseIdentifier(node.object);
  if (node.type === "ChainExpression") return getBaseIdentifier(node.expression);
  return null;
}

function isLiteralNode(node: TSESTree.Node): boolean {
  return node.type === "Literal" || node.type === "TemplateLiteral";
}

function isNarrowedByComparisonWithLiteral(
  left: TSESTree.Node,
  right: TSESTree.Node,
): string | null {
  if (
    left.type === "MemberExpression" &&
    left.property.type === "Identifier" &&
    right.type !== "Identifier" &&
    isLiteralNode(right)
  ) {
    return getBaseIdentifier(left.object);
  }
  if (
    right.type === "MemberExpression" &&
    right.property.type === "Identifier" &&
    left.type !== "Identifier" &&
    isLiteralNode(left)
  ) {
    return getBaseIdentifier(right.object);
  }
  if (left.type === "Identifier" && isLiteralNode(right)) {
    return left.name;
  }
  if (right.type === "Identifier" && isLiteralNode(left)) {
    return right.name;
  }
  return null;
}

function extractNarrowedVariableFromIfTest(
  test: TSESTree.Node,
): string | null {
  if (test.type !== "BinaryExpression") return null;
  if (!["===", "==", "!=", "!==", "instanceof"].includes(test.operator)) return null;

  const { left, right } = test;

  const comparisonResult = isNarrowedByComparisonWithLiteral(left, right);
  if (comparisonResult) return comparisonResult;

  if (test.operator === "instanceof") {
    return getBaseIdentifier(left);
  }

  if (
    test.operator === "===" &&
    left.type === "UnaryExpression" &&
    left.operator === "typeof"
  ) {
    if (right.type === "Literal" && typeof right.value === "string") {
      return getBaseIdentifier(left.argument);
    }
  }

  return null;
}

function extractNarrowedVariableFromSwitch(
  discriminant: TSESTree.Node,
): string | null {
  if (discriminant.type === "MemberExpression") {
    return getBaseIdentifier(discriminant.object);
  }
  if (discriminant.type === "Identifier") {
    return discriminant.name;
  }
  return null;
}

function isDescendantOrSelf(
  child: TSESTreeWithParent,
  ancestor: TSESTree.Node,
): boolean {
  let current: TSESTreeWithParent | undefined = child;
  while (current) {
    if (current === ancestor) return true;
    current = current.parent;
  }
  return false;
}

function findSwitchStatement(
  startFrom: TSESTreeWithParent,
): TSESTreeWithParent | null {
  let current: TSESTreeWithParent | undefined = startFrom;
  while (current) {
    const next: TSESTreeWithParent | undefined = current.parent;
    if (!next) return null;
    if (next.type === "SwitchStatement") return next;
    current = next;
  }
  return null;
}

function handleIfStatement(
  current: TSESTreeWithParent,
  parent: TSESTreeWithParent,
): string | null {
  const ifStmt = parent as unknown as TSESTree.IfStatement;
  if (!isDescendantOrSelf(current, ifStmt.consequent)) return null;
  const narrowed = extractNarrowedVariableFromIfTest(ifStmt.test);
  return narrowed || null;
}

function handleSwitchCase(
  parent: TSESTreeWithParent,
): string | null {
  const sc = parent as unknown as TSESTree.SwitchCase;
  if (sc.test === null) return null;
  const switchStmt = findSwitchStatement(parent);
  if (!switchStmt) return null;
  return extractNarrowedVariableFromSwitch(
    (switchStmt as unknown as TSESTree.SwitchStatement).discriminant,
  );
}

function findNarrowedVariable(node: TSESTree.BaseNode): string | null {
  let current: TSESTreeWithParent | undefined =
    node as unknown as TSESTreeWithParent;

  while (current) {
    const parent: TSESTreeWithParent | undefined = current.parent;
    if (!parent) return null;

    if (parent.type === "IfStatement") {
      const result = handleIfStatement(current, parent);
      if (result) return result;
    }

    if (parent.type === "SwitchCase") {
      const result = handleSwitchCase(parent);
      if (result) return result;
    }

    current = parent;
  }

  return null;
}

export default createRule({
  name: "no-as-any-in-narrowed-branch",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `as any` casts inside branches where TypeScript narrowing has already resolved the value's type.",
    },
    messages: {
      redundantAsAny:
        "Using `as any` inside a narrowed branch discards type safety. TypeScript's narrowing has already resolved the type. Remove the cast and rely on narrowing. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"redundantAsAny", []>) {
    return {
      TSAsExpression(node: TSESTree.TSAsExpression) {
        if (node.typeAnnotation.type !== "TSAnyKeyword") return;

        const castedExpr = node.expression;
        const castedBase = getBaseIdentifier(castedExpr);
        if (!castedBase) return;

        const narrowedVar = findNarrowedVariable(node);
        if (!narrowedVar) return;

        if (castedBase !== narrowedVar) return;

        context.report({
          node,
          messageId: "redundantAsAny",
          data: { url: URL },
        });
      },
    };
  },
});
