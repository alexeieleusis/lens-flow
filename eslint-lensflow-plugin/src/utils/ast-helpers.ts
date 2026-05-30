import ts from "typescript";
import { TSESTree } from "@typescript-eslint/utils";
import type { ParserServices } from "@typescript-eslint/utils";

const ASSERT_NEVER_PATTERN = /^assertNever$/;
const SKIP_KEYS = new Set(["parent", "loc", "range", "leadingComments", "trailingComments", "innerComments"]);

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

export function walk(
  root: TSESTree.Node,
  cb: (node: TSESTree.Node) => void,
): void {
  cb(root);
  for (const child of getChildren(root)) {
    walk(child, cb);
  }
}

export function walkNodes(
  root: TSESTree.Node,
  predicate: (node: TSESTree.Node) => boolean,
): boolean {
  const seen = new Set<TSESTree.Node>();
  function walk(node: TSESTree.Node): boolean {
    if (seen.has(node)) return false;
    seen.add(node);

    if (predicate(node)) return true;

    for (const child of getChildren(node)) {
      if (walk(child)) return true;
    }
    return false;
  }
  return walk(root);
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

  const isIdentifier =
    varNode.type === "Identifier" || varNode.type === "MemberExpression";
  if (!isIdentifier) return null;

  const tsVarNode = esTreeNodeToTSNodeMap.get(varNode);
  if (!tsVarNode) return null;

  const varName =
    varNode.type === "Identifier"
      ? varNode.name
      : getMemberName(varNode as TSESTree.MemberExpression);

  return { varName, tsVarNode, value };
}

function getMemberName(node: TSESTree.MemberExpression): string {
  if (node.property.type === "Identifier") {
    let objName: string;
    if (node.object.type === "Identifier") {
      objName = node.object.name;
    } else if (node.object.type === "MemberExpression") {
      objName = getMemberName(node.object);
    } else {
      objName = "";
    }
    return `${objName}.${node.property.name}`;
  }
  return "";
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

export { getMemberName };

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
