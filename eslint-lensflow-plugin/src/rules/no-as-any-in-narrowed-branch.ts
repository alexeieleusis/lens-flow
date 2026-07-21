import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T34-never-bottom.md");

function getBaseIdentifierNode(
  node: TSESTree.Node,
): TSESTree.Identifier | null {
  if (node.type === "Identifier") return node;
  if (node.type === "MemberExpression")
    return getBaseIdentifierNode(node.object);
  if (node.type === "ChainExpression")
    return getBaseIdentifierNode(node.expression);
  return null;
}

function isLiteralNode(node: TSESTree.Node): boolean {
  if (node.type === "Literal") return true;
  if (node.type === "TemplateLiteral") return node.expressions.length === 0;
  return false;
}

function isNarrowedByComparisonWithLiteral(
  left: TSESTree.Node,
  right: TSESTree.Node,
): TSESTree.Identifier | null {
  if (
    left.type === "MemberExpression" &&
    left.property.type === "Identifier" &&
    right.type !== "Identifier" &&
    isLiteralNode(right)
  ) {
    return getBaseIdentifierNode(left.object);
  }
  if (
    right.type === "MemberExpression" &&
    right.property.type === "Identifier" &&
    left.type !== "Identifier" &&
    isLiteralNode(left)
  ) {
    return getBaseIdentifierNode(right.object);
  }
  if (left.type === "Identifier" && isLiteralNode(right)) {
    return left;
  }
  if (right.type === "Identifier" && isLiteralNode(left)) {
    return right;
  }
  return null;
}

function extractNarrowedVariableFromIfTest(
  test: TSESTree.Node,
): TSESTree.Identifier | null {
  if (test.type !== "BinaryExpression") return null;
  if (!["===", "==", "!=", "!==", "instanceof"].includes(test.operator))
    return null;

  const { left, right } = test;

  const comparisonResult = isNarrowedByComparisonWithLiteral(left, right);
  if (comparisonResult) return comparisonResult;

  if (test.operator === "instanceof") {
    return getBaseIdentifierNode(left);
  }

  if (
    test.operator === "===" &&
    left.type === "UnaryExpression" &&
    left.operator === "typeof"
  ) {
    if (right.type === "Literal" && typeof right.value === "string") {
      return getBaseIdentifierNode(left.argument);
    }
  }

  return null;
}

function extractNarrowedVariableFromSwitch(
  discriminant: TSESTree.Node,
): TSESTree.Identifier | null {
  if (discriminant.type === "MemberExpression") {
    return getBaseIdentifierNode(discriminant.object);
  }
  if (discriminant.type === "Identifier") {
    return discriminant;
  }
  return null;
}

function isDescendantOrSelf(
  ancestors: TSESTree.Node[],
  ancestor: TSESTree.Node,
): boolean {
  return ancestors.includes(ancestor);
}

function findSwitchStatement(
  ancestors: TSESTree.Node[],
): TSESTree.SwitchStatement | null {
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const ancestor = ancestors[i];
    if (ancestor.type === "SwitchStatement") return ancestor;
    if (
      ancestor.type === "ArrowFunctionExpression" ||
      ancestor.type === "FunctionExpression" ||
      ancestor.type === "FunctionDeclaration"
    ) {
      return null;
    }
  }
  return null;
}

function handleIfStatement(
  ancestors: TSESTree.Node[],
  ifStmt: TSESTree.IfStatement,
): TSESTree.Identifier | null {
  if (!isDescendantOrSelf(ancestors, ifStmt.consequent)) return null;
  return extractNarrowedVariableFromIfTest(ifStmt.test);
}

function handleSwitchCase(
  ancestors: TSESTree.Node[],
  sc: TSESTree.SwitchCase,
): TSESTree.Identifier | null {
  if (sc.test === null) return null;
  const switchStmt = findSwitchStatement(ancestors);
  if (!switchStmt) return null;
  return extractNarrowedVariableFromSwitch(switchStmt.discriminant);
}

function resolveVariable(
  scopes: unknown[],
  identifier: TSESTree.Identifier,
): TSESLint.Scope.Variable | null {
  let innermost: {
    block: TSESTree.Node;
    references: unknown[];
    upper: unknown;
  } | null = null;
  for (const scope of scopes) {
    const s = scope as {
      block: TSESTree.Node;
      references: unknown[];
      upper: unknown;
    };
    const block = s.block;
    if (!block?.range) continue;
    if (
      identifier.range[0] >= block.range[0] &&
      identifier.range[1] <= block.range[1]
    ) {
      innermost = s;
    }
  }
  if (!innermost) return null;

  let current = innermost;
  while (current) {
    for (const ref of current.references || []) {
      const r = ref as {
        identifier: TSESTree.Node;
        resolved: TSESLint.Scope.Variable | null;
      };
      if (r.identifier === identifier && r.resolved) {
        return r.resolved;
      }
    }
    current = current.upper as typeof innermost;
  }
  return null;
}

function hasReassignmentBetween(
  variable: TSESLint.Scope.Variable,
  guardEnd: number,
  castStart: number,
): boolean {
  for (const reference of variable.references) {
    if (reference.isWrite()) {
      const refRange = reference.identifier.range;
      if (refRange && refRange[0] > guardEnd && refRange[0] < castStart) {
        return true;
      }
    }
  }
  return false;
}

type NarrowedCandidate = { id: TSESTree.Identifier; guard: TSESTree.Node };

function extractGuardFromIf(
  ancestors: TSESTree.Node[],
  ifStmt: TSESTree.IfStatement,
): NarrowedCandidate | null {
  const narrowed = handleIfStatement(ancestors, ifStmt);
  if (!narrowed) return null;
  return { id: narrowed, guard: ifStmt.test };
}

function extractGuardFromSwitch(
  ancestors: TSESTree.Node[],
  sc: TSESTree.SwitchCase,
): NarrowedCandidate | null {
  const narrowed = handleSwitchCase(ancestors, sc);
  if (!narrowed) return null;
  return { id: narrowed, guard: sc };
}

function isFunctionBoundary(node: TSESTree.Node): boolean {
  return (
    node.type === "ArrowFunctionExpression" ||
    node.type === "FunctionExpression" ||
    node.type === "FunctionDeclaration"
  );
}

function findNarrowedVariable(
  ancestors: TSESTree.Node[],
  castedId: TSESTree.Identifier,
  scopes: unknown[],
): NarrowedCandidate | null {
  const castedVar = resolveVariable(scopes, castedId);
  if (!castedVar) return null;

  for (let i = ancestors.length - 1; i >= 0; i--) {
    const parent = ancestors[i];

    if (isFunctionBoundary(parent)) {
      return null;
    }

    let candidate: NarrowedCandidate | null = null;

    if (parent.type === "IfStatement") {
      candidate = extractGuardFromIf(ancestors, parent);
    } else if (parent.type === "SwitchCase") {
      candidate = extractGuardFromSwitch(ancestors, parent);
    }

    if (candidate && resolveVariable(scopes, candidate.id) === castedVar) {
      return candidate;
    }
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
    const sourceCode = context.sourceCode;

    return {
      TSAsExpression(node: TSESTree.TSAsExpression) {
        if (node.typeAnnotation.type !== "TSAnyKeyword") return;

        const castedId = getBaseIdentifierNode(node.expression);
        if (!castedId) return;

        const scopeManager = sourceCode.scopeManager;
        if (!scopeManager) return;

        const scopes = (scopeManager as { scopes: unknown[] }).scopes;
        if (!scopes) return;

        const ancestors = sourceCode.getAncestors(node);
        const castedVar = resolveVariable(scopes, castedId);
        const narrowedResult = findNarrowedVariable(
          ancestors,
          castedId,
          scopes,
        );
        if (!narrowedResult) return;

        if (castedVar && narrowedResult.guard.range) {
          if (
            hasReassignmentBetween(
              castedVar,
              narrowedResult.guard.range[1],
              castedId.range[0],
            )
          ) {
            return;
          }
        }

        context.report({
          node,
          messageId: "redundantAsAny",
          data: { url: URL },
        });
      },
    };
  },
});
