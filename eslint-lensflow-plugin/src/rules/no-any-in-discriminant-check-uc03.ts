import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

const DISCRIMINANT_NAMES = new Set([
  "kind",
  "type",
  "status",
  "tag",
  "discriminant",
  "variant",
  "state",
  "role",
  "name",
]);

function getBaseIdentifier(
  node: TSESTree.Node,
): TSESTree.Identifier | null {
  if (node.type === "Identifier") return node;
  if (node.type === "MemberExpression") return getBaseIdentifier(node.object);
  if (node.type === "ChainExpression") return getBaseIdentifier(node.expression);
  return null;
}

function isDiscriminantProperty(name: string): boolean {
  return DISCRIMINANT_NAMES.has(name);
}

function findEnclosingIf(
  node: TSESTree.Node,
): TSESTree.IfStatement | null {
  let current: TSESTree.Node | undefined = node.parent;
  while (current) {
    if (current.type === "IfStatement") return current;
    current = current.parent;
  }
  return null;
}

function findEnclosingSwitch(
  node: TSESTree.Node,
): TSESTree.SwitchStatement | null {
  let current: TSESTree.Node | undefined = node.parent;
  while (current) {
    if (current.type === "SwitchStatement") return current;
    current = current.parent;
  }
  return null;
}

function extractBaseFromTest(
  test: TSESTree.Expression,
): TSESTree.Identifier | null {
  if (test.type === "BinaryExpression") {
    const leftBase = getBaseIdentifier(test.left);
    if (
      test.left.type === "MemberExpression" &&
      test.left.property.type === "Identifier" &&
      isDiscriminantProperty(test.left.property.name) &&
      leftBase
    ) {
      return leftBase;
    }
    const rightBase = getBaseIdentifier(test.right);
    if (
      test.right.type === "MemberExpression" &&
      test.right.property.type === "Identifier" &&
      isDiscriminantProperty(test.right.property.name) &&
      rightBase
    ) {
      return rightBase;
    }
  }
  if (test.type === "LogicalExpression") {
    const leftBase = extractBaseFromTest(test.left);
    if (leftBase) return leftBase;
    return extractBaseFromTest(test.right);
  }
  if (test.type === "MemberExpression") {
    return getBaseIdentifier(test.object);
  }
  return null;
}

function extractBaseFromSwitchDiscriminant(
  discriminant: TSESTree.Expression,
): TSESTree.Identifier | null {
  const base = getBaseIdentifier(discriminant);
  if (
    discriminant.type === "MemberExpression" &&
    discriminant.property.type === "Identifier" &&
    isDiscriminantProperty(discriminant.property.name) &&
    base
  ) {
    return base;
  }
  return null;
}

function extractPropName(expr: TSESTree.Expression): string {
  if (
    expr.type === "MemberExpression" &&
    expr.property.type === "Identifier"
  ) {
    return expr.property.name;
  }
  if (
    expr.type === "BinaryExpression" &&
    expr.left.type === "MemberExpression" &&
    expr.left.property.type === "Identifier"
  ) {
    return expr.left.property.name;
  }
  return "property";
}

function reportIfCastInDiscriminantCheck(
  context: Parameters<ReturnType<typeof createRule>["create"]>["0"],
  node: TSESTree.TSAsExpression,
  castBase: TSESTree.Identifier,
) {
  const enclosingIf = findEnclosingIf(node);
  if (enclosingIf) {
    const testBase = extractBaseFromTest(enclosingIf.test);
    if (testBase?.name === castBase.name) {
      context.report({
        node,
        messageId: "ifDiscriminant",
        data: {
          base: castBase.name,
          discriminant: extractPropName(enclosingIf.test),
        },
      });
      return true;
    }
  }
  return false;
}

function reportSwitchCastInDiscriminantCheck(
  context: Parameters<ReturnType<typeof createRule>["create"]>["0"],
  node: TSESTree.TSAsExpression,
  castBase: TSESTree.Identifier,
) {
  const enclosingSwitch = findEnclosingSwitch(node);
  if (enclosingSwitch) {
    const switchBase = extractBaseFromSwitchDiscriminant(
      enclosingSwitch.discriminant,
    );
    if (switchBase?.name === castBase.name) {
      context.report({
        node,
        messageId: "switchDiscriminant",
        data: {
          base: castBase.name,
          discriminant: extractPropName(enclosingSwitch.discriminant),
        },
      });
      return true;
    }
  }
  return false;
}

export default createRule({
  name: "no-any-in-discriminant-check-uc03",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `as any` casts inside conditional blocks that check a discriminant-like property on the same expression",
    },
    messages: {
      ifDiscriminant:
        "Using `as any` inside a conditional that checks `{{discriminant}}` on `{{base}}`. Use a discriminated union with proper narrowing instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/usecases/UC03-exhaustiveness.md",
      switchDiscriminant:
        "Using `as any` inside a `switch` on `{{base}}.{{discriminant}}`. Use a discriminated union with proper narrowing instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/usecases/UC03-exhaustiveness.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"ifDiscriminant" | "switchDiscriminant", []>) {
    return {
      TSAsExpression(node) {
        if (node.typeAnnotation.type !== "TSAnyKeyword") return;

        const castBase = getBaseIdentifier(node.expression);
        if (!castBase) return;

        if (reportIfCastInDiscriminantCheck(context, node, castBase)) return;
        reportSwitchCastInDiscriminantCheck(context, node, castBase);
      },
    };
  },
});
