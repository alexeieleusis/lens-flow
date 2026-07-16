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

function isFunctionBoundary(node: TSESTree.Node): boolean {
  return (
    node.type === "FunctionExpression" ||
    node.type === "ArrowFunctionExpression" ||
    node.type === "FunctionDeclaration"
  );
}

function findEnclosingIf(
  context: Parameters<ReturnType<typeof createRule>["create"]>["0"],
  node: TSESTree.Node,
): TSESTree.IfStatement | null {
  const ancestors = context.sourceCode.getAncestors(node);
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const current = ancestors[i];
    if (isFunctionBoundary(current)) return null;
    if (current.type === "IfStatement") return current;
  }
  return null;
}

function findEnclosingSwitch(
  context: Parameters<ReturnType<typeof createRule>["create"]>["0"],
  node: TSESTree.Node,
): TSESTree.SwitchStatement | null {
  const ancestors = context.sourceCode.getAncestors(node);
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const current = ancestors[i];
    if (isFunctionBoundary(current)) return null;
    if (current.type === "SwitchStatement") return current;
  }
  return null;
}

function isDiscriminantMember(
  expr: TSESTree.Expression,
): expr is TSESTree.MemberExpression & { property: TSESTree.Identifier } {
  return (
    expr.type === "MemberExpression" &&
    expr.property.type === "Identifier" &&
    isDiscriminantProperty(expr.property.name)
  );
}

function addBases(bases: Set<TSESTree.Identifier>, source: Iterable<TSESTree.Identifier>) {
  for (const b of source) bases.add(b);
}

function processBinaryExpression(
  test: TSESTree.BinaryExpression,
): Set<TSESTree.Identifier> {
  const bases = new Set<TSESTree.Identifier>();
  const sides: TSESTree.Expression[] = [test.left, test.right].filter(
    (n): n is TSESTree.Expression => n.type !== "PrivateIdentifier",
  );
  for (const side of sides) {
    if (isDiscriminantMember(side)) {
      const base = getBaseIdentifier(side);
      if (base) bases.add(base);
    }
  }
  return bases;
}

function processCallExpression(
  test: TSESTree.CallExpression,
): Set<TSESTree.Identifier> {
  const bases = new Set<TSESTree.Identifier>();
  for (const arg of test.arguments) {
    if (arg.type !== "SpreadElement") {
      addBases(bases, extractBasesFromTest(arg));
    }
  }
  return bases;
}

function extractBasesFromTest(
  test: TSESTree.Expression,
): Set<TSESTree.Identifier> {
  if (test.type === "BinaryExpression") return processBinaryExpression(test);
  if (test.type === "LogicalExpression") {
    const bases = new Set<TSESTree.Identifier>();
    addBases(bases, extractBasesFromTest(test.left));
    addBases(bases, extractBasesFromTest(test.right));
    return bases;
  }
  if (test.type === "UnaryExpression") return extractBasesFromTest(test.argument);
  if (test.type === "CallExpression") return processCallExpression(test);
  if (isDiscriminantMember(test)) {
    const base = getBaseIdentifier(test.object);
    if (base) return new Set([base]);
  }
  return new Set();
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

function checkBinaryDiscriminant(
  test: TSESTree.BinaryExpression,
  baseName: string,
): string | null {
  const side =
    getBaseIdentifier(test.left)?.name === baseName ? test.left : test.right;
  if (
    side.type === "MemberExpression" &&
    side.property.type === "Identifier" &&
    isDiscriminantProperty(side.property.name)
  ) {
    return side.property.name;
  }
  return null;
}

function checkLogicalDiscriminant(
  test: TSESTree.LogicalExpression,
  baseName: string,
): string | null {
  const left = findDiscriminantForBase(test.left, baseName);
  if (left) return left;
  return findDiscriminantForBase(test.right, baseName);
}

function checkCallDiscriminant(
  test: TSESTree.CallExpression,
  baseName: string,
): string | null {
  for (const arg of test.arguments) {
    if (arg.type !== "SpreadElement") {
      const found = findDiscriminantForBase(arg, baseName);
      if (found) return found;
    }
  }
  return null;
}

function checkMemberDiscriminant(
  test: TSESTree.MemberExpression,
  baseName: string,
): string | null {
  if (
    test.property.type === "Identifier" &&
    isDiscriminantProperty(test.property.name)
  ) {
    const base = getBaseIdentifier(test.object);
    if (base?.name === baseName) return test.property.name;
  }
  return null;
}

function findDiscriminantForBase(
  test: TSESTree.Expression,
  baseName: string,
): string | null {
  if (test.type === "BinaryExpression") return checkBinaryDiscriminant(test, baseName);
  if (test.type === "LogicalExpression") return checkLogicalDiscriminant(test, baseName);
  if (test.type === "UnaryExpression") return findDiscriminantForBase(test.argument, baseName);
  if (test.type === "CallExpression") return checkCallDiscriminant(test, baseName);
  if (test.type === "MemberExpression") return checkMemberDiscriminant(test, baseName);
  return null;
}

function isCastDirectlyOnBase(
  expr: TSESTree.Expression,
  base: TSESTree.Identifier,
): boolean {
  let target: TSESTree.Expression = expr;
  if (target.type === "ChainExpression") target = target.expression;
  return target === base;
}

function areSameVariable(
  scopeManager: TSESLint.Scope.ScopeManager,
  controlStructure: TSESTree.Node,
  id1: TSESTree.Identifier,
  id2: TSESTree.Identifier,
): boolean {
  if (id1 === id2) return true;
  if (id1.name !== id2.name) return false;

  const resolveScope = (
    node: TSESTree.Node,
    scope: TSESLint.Scope.Scope,
  ): TSESLint.Scope.Scope | null => {
    let best: TSESLint.Scope.Scope | null = null;
    const walk = (s: TSESLint.Scope.Scope) => {
      let cur: TSESTree.Node | undefined = node;
      while (cur) {
        if (cur === s.block) {
          best = s;
          for (const c of s.childScopes) walk(c);
          return;
        }
        cur = cur.parent;
      }
    };
    walk(scope);
    return best;
  };

  const findScopeForNode = (
    node: TSESTree.Node,
  ): TSESLint.Scope.Scope | null => {
    let cur: TSESTree.Node | undefined = node;
    while (cur) {
      const acquired = scopeManager.acquire(cur);
      if (acquired) return acquired;
      cur = cur.parent;
    }
    return null;
  };

  const moduleScope =
    scopeManager.scopes.find((s) => s.type === "module") ??
    scopeManager.globalScope;
  if (!moduleScope) return true;
  const castScope = resolveScope(id2, moduleScope);
  if (!castScope) return true;

  const controlScope = findScopeForNode(controlStructure);
  if (!controlScope) return true;

  const scopesBetween: TSESLint.Scope.Scope[] = [];
  let scope: TSESLint.Scope.Scope | null = castScope;
  while (scope && scope !== controlScope) {
    scopesBetween.push(scope);
    scope = scope.upper || null;
  }
  if (!scope) return true;

  for (const s of scopesBetween) {
    for (const v of s.variables) {
      if (v.name === id1.name) return false;
    }
  }
  return true;
}

function reportIfCastInDiscriminantCheck(
  context: Parameters<ReturnType<typeof createRule>["create"]>["0"],
  node: TSESTree.TSAsExpression,
  castBase: TSESTree.Identifier,
) {
  const enclosingIf = findEnclosingIf(context, node);
  if (enclosingIf) {
    const scopeManager = context.sourceCode.scopeManager;
    if (!scopeManager) return false;
    const testBases = extractBasesFromTest(enclosingIf.test);
    const match = Array.from(testBases).find(
      (b) =>
        b.name === castBase.name &&
        areSameVariable(scopeManager, enclosingIf, b, castBase),
    );
    if (match) {
      const discriminant = findDiscriminantForBase(enclosingIf.test, castBase.name) ?? "property";
      context.report({
        node,
        messageId: "ifDiscriminant",
        data: {
          base: castBase.name,
          discriminant,
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
  const enclosingSwitch = findEnclosingSwitch(context, node);
  if (enclosingSwitch) {
    const scopeManager = context.sourceCode.scopeManager;
    if (!scopeManager) return false;
    const switchBase = extractBaseFromSwitchDiscriminant(
      enclosingSwitch.discriminant,
    );
    if (
      switchBase?.name === castBase.name &&
      areSameVariable(scopeManager, enclosingSwitch, switchBase, castBase)
    ) {
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
        "Using `as any` inside a conditional that checks `{{discriminant}}` on `{{base}}`. Use a discriminated union with proper narrowing instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC03-exhaustiveness.md",
      switchDiscriminant:
        "Using `as any` inside a `switch` on `{{base}}.{{discriminant}}`. Use a discriminated union with proper narrowing instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC03-exhaustiveness.md",
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
        if (!castBase || !isCastDirectlyOnBase(node.expression, castBase)) return;

        if (reportIfCastInDiscriminantCheck(context, node, castBase)) return;
        reportSwitchCastInDiscriminantCheck(context, node, castBase);
      },
    };
  },
});
