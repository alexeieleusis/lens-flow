import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T34-never-bottom.md");

interface TSESTreeWithParent {
  type: string;
  parent?: TSESTreeWithParent;
}

function getBaseIdentifierNode(node: TSESTree.Node): TSESTree.Identifier | null {
  if (node.type === "Identifier") return node;
  if (node.type === "MemberExpression") return getBaseIdentifierNode(node.object);
  if (node.type === "ChainExpression") return getBaseIdentifierNode(node.expression);
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
  if (!["===", "==", "!=", "!==", "instanceof"].includes(test.operator)) return null;

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
    if (
      next.type === "ArrowFunctionExpression" ||
      next.type === "FunctionExpression" ||
      next.type === "FunctionDeclaration"
    ) {
      return null;
    }
    current = next;
  }
  return null;
}

function handleIfStatement(
  current: TSESTreeWithParent,
  parent: TSESTreeWithParent,
): TSESTree.Identifier | null {
  const ifStmt = parent as unknown as TSESTree.IfStatement;
  if (!isDescendantOrSelf(current, ifStmt.consequent)) return null;
  return extractNarrowedVariableFromIfTest(ifStmt.test);
}

function handleSwitchCase(
  parent: TSESTreeWithParent,
): TSESTree.Identifier | null {
  const sc = parent as unknown as TSESTree.SwitchCase;
  if (sc.test === null) return null;
  const switchStmt = findSwitchStatement(parent);
  if (!switchStmt) return null;
  return extractNarrowedVariableFromSwitch(
    (switchStmt as unknown as TSESTree.SwitchStatement).discriminant,
  );
}

function resolveVariable(
  scopeManager: NonNullable<TSESLint.SourceCode["scopeManager"]>,
  identifier: TSESTree.Identifier,
): TSESLint.Scope.Variable | null {
  const scopes = (scopeManager as { scopes: unknown[] }).scopes;
  if (!scopes) return null;

  // Find the innermost scope containing the identifier.
  let innermost: { block: TSESTree.Node } | null = null;
  for (const scope of scopes) {
    const s = scope as { block: TSESTree.Node };
    const block = s.block;
    if (!block?.range) continue;
    if (
      identifier.range![0] >= block.range[0] &&
      identifier.range![1] <= block.range[1]
    ) {
      innermost = s;
    }
  }
  if (!innermost) return null;

  // Walk up the scope chain looking for the reference to this identifier.
  // The reference may be in an outer scope (e.g., switch discriminant `m`
  // has its reference in the function scope, not the switch scope).
  let current: { references: unknown[]; upper: unknown } | null =
    innermost as unknown as { references: unknown[]; upper: unknown };
  while (current) {
    const refs = current.references;
    if (refs) {
      for (const ref of refs) {
        const r = ref as {
          identifier: TSESTree.Node;
          resolved: TSESLint.Scope.Variable | null;
        };
        if (r.identifier === identifier && r.resolved) {
          return r.resolved;
        }
      }
    }
    current = current.upper as {
      references: unknown[];
      upper: unknown;
    } | null;
  }
  return null;
}

function findNarrowedVariable(
  node: TSESTree.BaseNode,
  castedId: TSESTree.Identifier,
  scopeManager: NonNullable<TSESLint.SourceCode["scopeManager"]>,
): TSESTree.Identifier | null {
  let current: TSESTreeWithParent | undefined =
    node as unknown as TSESTreeWithParent;

  while (current) {
    const parent: TSESTreeWithParent | undefined = current.parent;
    if (!parent) return null;

    if (
      parent.type === "ArrowFunctionExpression" ||
      parent.type === "FunctionExpression" ||
      parent.type === "FunctionDeclaration"
    ) {
      return null;
    }

    let candidate: TSESTree.Identifier | null = null;

    if (parent.type === "IfStatement") {
      candidate = handleIfStatement(current, parent);
    }

    if (parent.type === "SwitchCase") {
      candidate = handleSwitchCase(parent);
    }

    if (candidate) {
      const castedVar = resolveVariable(scopeManager, castedId);
      if (castedVar && resolveVariable(scopeManager, candidate) === castedVar) {
        return candidate;
      }
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
    const sourceCode = context.sourceCode;

    return {
      TSAsExpression(node: TSESTree.TSAsExpression) {
        if (node.typeAnnotation.type !== "TSAnyKeyword") return;

        const castedId = getBaseIdentifierNode(node.expression);
        if (!castedId) return;

        const scopeManager = sourceCode.scopeManager;
        if (!scopeManager) return;

        const narrowedId = findNarrowedVariable(node, castedId, scopeManager);
        if (!narrowedId) return;

        context.report({
          node,
          messageId: "redundantAsAny",
          data: { url: URL },
        });
      },
    };
  },
});
