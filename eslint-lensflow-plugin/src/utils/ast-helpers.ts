import ts from "typescript";
import { TSESTree } from "@typescript-eslint/utils";
import type { ParserServices } from "@typescript-eslint/utils";

const ASSERT_NEVER_PATTERN = /^assertNever$/;
const SKIP_KEYS = new Set([
  "parent",
  "loc",
  "range",
  "leadingComments",
  "trailingComments",
  "innerComments",
  "typeAnnotation",
  "typeArguments",
  "returnType",
]);

function isNodeLike(val: unknown): val is TSESTree.Node {
  return val != null && typeof val === "object" && "type" in val;
}

function collectNodeArray(val: unknown[], children: TSESTree.Node[]): void {
  for (const item of val) {
    if (isNodeLike(item)) {
      children.push(item);
    }
  }
}

export function getChildren(node: TSESTree.Node): TSESTree.Node[] {
  const children: TSESTree.Node[] = [];

  for (const key of Object.keys(node)) {
    if (SKIP_KEYS.has(key)) continue;
    const val = (node as unknown as Record<string, unknown>)[key];
    if (!(val && typeof val === "object")) continue;

    if (Array.isArray(val)) {
      collectNodeArray(val, children);
    } else if ("type" in val) {
      children.push(val as TSESTree.Node);
    }
  }
  return children;
}

const FUNCTION_BOUNDARY_TYPES = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
]);

function isFunctionBoundary(node: TSESTree.Node): boolean {
  return FUNCTION_BOUNDARY_TYPES.has(node.type);
}

export interface WalkOptions {
  /**
   * When true, the walker will not descend into nested function bodies.
   * ESLint visits nested functions as separate entry points, so descending
   * into them would attribute inner-function constructs to the outer scope
   * and produce false positives. Defaults to `true`.
   */
  stopAtFunctionBoundaries?: boolean;
}

export function walk(
  root: TSESTree.Node,
  cb: (node: TSESTree.Node) => void,
  options: WalkOptions = {},
): void {
  const stopBoundary = options.stopAtFunctionBoundaries ?? true;
  cb(root);
  for (const child of getChildren(root)) {
    if (stopBoundary && isFunctionBoundary(child)) continue;
    walk(child, cb, options);
  }
}

export function walkNodes(
  root: TSESTree.Node,
  predicate: (node: TSESTree.Node) => boolean,
  options: WalkOptions = {},
): boolean {
  const stopBoundary = options.stopAtFunctionBoundaries ?? true;
  const seen = new Set<TSESTree.Node>();
  function innerWalk(node: TSESTree.Node): boolean {
    if (seen.has(node)) return false;
    seen.add(node);

    if (predicate(node)) return true;

    for (const child of getChildren(node)) {
      if (stopBoundary && isFunctionBoundary(child)) continue;
      if (innerWalk(child)) return true;
    }
    return false;
  }
  return innerWalk(root);
}

export function hasAssertNever(stmt: TSESTree.Statement): boolean {
  return walkNodes(stmt, (node) => {
    if (node.type !== "CallExpression") return false;
    const ce = node;
    return (
      ce.callee.type === "Identifier" &&
      ASSERT_NEVER_PATTERN.test(ce.callee.name)
    );
  });
}

export function hasThrow(stmt: TSESTree.Statement): boolean {
  return walkNodes(stmt, (node) => node.type === "ThrowStatement");
}

export function nodeHasAssertNeverOrThrow(stmt: TSESTree.Statement): boolean {
  return walkNodes(stmt, (node) => {
    if (node.type === "ThrowStatement") return true;
    if (node.type !== "CallExpression") return false;
    const ce = node;
    return (
      ce.callee.type === "Identifier" &&
      ASSERT_NEVER_PATTERN.test(ce.callee.name)
    );
  });
}

export function defaultHasNeverAssertion(
  consequent: TSESTree.Statement[],
): boolean {
  if (consequent.length === 0) return false;
  const nonEmpty = consequent.filter((s) => s.type !== "EmptyStatement");
  if (nonEmpty.length === 0) return false;
  return nonEmpty.some((s) => nodeHasAssertNeverOrThrow(s));
}

export function getLiteralFromExpr(
  expr: TSESTree.Node | null | undefined,
): string | number | null {
  if (!expr) return null;
  if (expr.type === "Literal" && typeof expr.value === "string")
    return expr.value;
  if (expr.type === "Literal" && typeof expr.value === "number")
    return expr.value;
  return null;
}

export interface ComparisonInfo {
  varName: string;
  tsVarNode: ts.Node;
  value: string;
}

export function getComparisonInfo(
  test: TSESTree.Node | undefined,
  esTreeNodeToTSNodeMap: ParserServices["esTreeNodeToTSNodeMap"],
): ComparisonInfo | null {
  if (
    test?.type !== "BinaryExpression" ||
    test.operator !== "==="
  )
    return null;

  let varNode: TSESTree.Node | undefined;
  let value: string | undefined;

  if (
    test.right.type === "Literal" &&
    typeof test.right.value === "string"
  ) {
    varNode = test.left;
    value = test.right.value;
  } else if (
    test.left.type === "Literal" &&
    typeof test.left.value === "string"
  ) {
    varNode = test.right;
    value = test.left.value;
  }

  if (!varNode || value === undefined) return null;

  if (varNode.type === "Identifier") {
    const tsVarNode = esTreeNodeToTSNodeMap.get(varNode);
    if (!tsVarNode) return null;
    return { varName: varNode.name, tsVarNode, value };
  }

  if (varNode.type !== "MemberExpression") return null;
  if (varNode.computed || varNode.property.type !== "Identifier") return null;

  const memberName = getMemberName(varNode);
  if (!memberName) return null;

  const tsVarNode = esTreeNodeToTSNodeMap.get(varNode);
  if (!tsVarNode) return null;

  return { varName: memberName, tsVarNode, value };
}

function getMemberName(node: TSESTree.MemberExpression): string | null {
  if (node.computed || node.property.type !== "Identifier") return null;

  if (node.object.type === "Identifier") {
    return `${node.object.name}.${node.property.name}`;
  }
  if (node.object.type === "MemberExpression") {
    const objName = getMemberName(node.object);
    if (!objName) return null;
    return `${objName}.${node.property.name}`;
  }

  // Reject `this.foo`, `super.foo`, and any other non-Identifier root objects.
  return null;
}

export function collectComparisonValues(
  firstInfo: ComparisonInfo,
  getNextInfo: () => ComparisonInfo | null,
): Set<string> {
  const handled = new Set<string>();
  handled.add(firstInfo.value);

  let currentInfo = getNextInfo();
  while (currentInfo?.varName === firstInfo.varName) {
    handled.add(currentInfo.value);
    currentInfo = getNextInfo();
  }

  return handled;
}

/**
 * Context passed to the handler for each if-chain start found by
 * {@link findIfChainStarts}.
 */
export interface IfChainStartContext {
  /** The first `if` statement in the chain. */
  ifStmt: TSESTree.IfStatement;
  /** The comparison info for the first `if` in the chain. */
  info: ComparisonInfo;
  /** Values compared in all consecutive `if` statements for the same variable. */
  consecutiveValues: Set<string>;
  /** Index of the first statement after the consecutive if chain. */
  nextIndex: number;
}

/**
 * Iterates over statements, finding the first `if` of each chain of consecutive
 * `if` statements that compare the same variable. Skips subsequent `if`s in the
 * same chain to avoid duplicate processing.
 *
 * For each chain start, collects all consecutive `if` statements comparing the
 * same variable and invokes the handler.
 */
function isContinuationOfChain(
  statements: TSESTree.Statement[],
  index: number,
  currentVarName: string,
  esTreeNodeToTSNodeMap: ParserServices["esTreeNodeToTSNodeMap"],
): boolean {
  if (index === 0) return false;
  const prev = statements[index - 1];
  if (prev.type !== "IfStatement") return false;

  const prevInfo = getComparisonInfo(
    prev.test,
    esTreeNodeToTSNodeMap,
  );
  return prevInfo?.varName === currentVarName;
}

function collectConsecutiveValues(
  statements: TSESTree.Statement[],
  startFrom: number,
  varName: string,
  firstValue: string,
  esTreeNodeToTSNodeMap: ParserServices["esTreeNodeToTSNodeMap"],
): { consecutiveValues: Set<string>; nextIndex: number } {
  const consecutiveValues = new Set<string>();
  consecutiveValues.add(firstValue);

  let j = startFrom;
  while (j < statements.length && statements[j].type === "IfStatement") {
    const nextInfo = getComparisonInfo(
      (statements[j] as TSESTree.IfStatement).test,
      esTreeNodeToTSNodeMap,
    );
    if (nextInfo?.varName !== varName) break;
    consecutiveValues.add(nextInfo.value);
    j++;
  }

  return { consecutiveValues, nextIndex: j };
}

export function findIfChainStarts(
  statements: TSESTree.Statement[],
  esTreeNodeToTSNodeMap: ParserServices["esTreeNodeToTSNodeMap"],
  handler: (ctx: IfChainStartContext) => void,
): void {
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    if (stmt.type !== "IfStatement") continue;

    const info = getComparisonInfo(stmt.test, esTreeNodeToTSNodeMap);
    if (!info) continue;

    if (isContinuationOfChain(statements, i, info.varName, esTreeNodeToTSNodeMap)) {
      continue;
    }

    const { consecutiveValues, nextIndex } = collectConsecutiveValues(
      statements,
      i + 1,
      info.varName,
      info.value,
      esTreeNodeToTSNodeMap,
    );

    handler({ ifStmt: stmt, info, consecutiveValues, nextIndex });
  }
}
