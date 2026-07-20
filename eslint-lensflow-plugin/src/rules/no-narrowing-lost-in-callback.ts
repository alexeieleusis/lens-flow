import ts from "typescript";
import { TSESTree, ESLintUtils, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T14-type-narrowing.md");

const ASYNC_FN_NAMES = new Set([
  "setTimeout",
  "setInterval",
  "setImmediate",
]);

const ASYNC_MEMBER_METHODS = new Set(["then", "catch", "finally"]);

function isNullishNode(node: TSESTree.Node): boolean {
  return (
    (node.type === "Identifier" && node.name === "undefined") ||
    (node.type === "Literal" && node.value === null)
  );
}

function handleEqualityNarrowing(
  left: TSESTree.Node,
  right: TSESTree.Node,
): { varName: string; varNode: TSESTree.Identifier } | null {
  if (isNullishNode(left) && right.type === "Identifier") {
    return { varName: right.name, varNode: right };
  }
  if (isNullishNode(right) && left.type === "Identifier") {
    return { varName: left.name, varNode: left };
  }
  return null;
}

function isNarrowingTest(node: TSESTree.Node): {
  varName: string;
  varNode: TSESTree.Identifier;
} | null {
  if (node.type !== "BinaryExpression") return null;

  const { left, right, operator } = node;

  if (operator === "!=" || operator === "!==") {
    if (isNullishNode(right) && left.type === "Identifier") {
      return { varName: left.name, varNode: left };
    }
    return null;
  }

  if (operator === "==" || operator === "===") {
    return handleEqualityNarrowing(left, right);
  }

  return null;
}

function collectIdentifiersInNode(
  node: TSESTree.Node,
  visited: WeakSet<object> = new WeakSet(),
): string[] {
  if (visited.has(node)) return [];
  visited.add(node);

  const ids: string[] = [];
  if (node.type === "Identifier") {
    ids.push(node.name);
  }

  const isFuncBoundary =
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression" ||
    node.type === "ArrowFunctionExpression";

  for (const key of Object.keys(node)) {
    if (key === "parent" || key === "loc" || key === "range") continue;
    if (isFuncBoundary && key === "body") continue;
    const val = (node as unknown as Record<string, unknown>)[key];
    for (const child of collectChildNodes(val)) {
      ids.push(...collectIdentifiersInNode(child, visited));
    }
  }
  return ids;
}

function isCallbackArg(
  callNode: TSESTree.CallExpression,
): TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression | null {
  const callee = callNode.callee;

  if (callee.type === "Identifier" && ASYNC_FN_NAMES.has(callee.name)) {
    const arg = callNode.arguments[0];
    if (
      arg &&
      (arg.type === "ArrowFunctionExpression" ||
        arg.type === "FunctionExpression")
    ) {
      return arg;
    }
    return null;
  }

  if (
    callee.type === "MemberExpression" &&
    callee.property.type === "Identifier" &&
    ASYNC_MEMBER_METHODS.has(callee.property.name)
  ) {
    const arg = callNode.arguments[0];
    if (
      arg &&
      (arg.type === "ArrowFunctionExpression" ||
        arg.type === "FunctionExpression")
    ) {
      return arg;
    }
    return null;
  }

  return null;
}

function collectChildNodes(
  val: unknown,
): TSESTree.Node[] {
  if (Array.isArray(val)) {
    const nodes: TSESTree.Node[] = [];
    for (const item of val) {
      if (item && typeof item === "object" && "type" in item) {
        nodes.push(item as TSESTree.Node);
      }
    }
    return nodes;
  }
  if (val != null && typeof val === "object" && "type" in val) {
    return [val as TSESTree.Node];
  }
  return [];
}

function findCallbacksFromValue(
  val: unknown,
  visited: WeakSet<object>,
): (TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression)[] {
  const results: (
    | TSESTree.ArrowFunctionExpression
    | TSESTree.FunctionExpression
  )[] = [];
  if (val && typeof val === "object") {
    for (const child of collectChildNodes(val)) {
      results.push(...findCallbacks(child, visited));
    }
  }
  return results;
}

function findCallbacks(
  node: TSESTree.Node,
  visited: WeakSet<object> = new WeakSet(),
): (TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression)[] {
  if (visited.has(node)) return [];
  visited.add(node);

  const callbacks: (
    | TSESTree.ArrowFunctionExpression
    | TSESTree.FunctionExpression
  )[] = [];

  if (node.type === "CallExpression") {
    const cb = isCallbackArg(node);
    if (cb) callbacks.push(cb);
  }

  const skipBody =
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression" ||
    node.type === "ArrowFunctionExpression";

  for (const key of Object.keys(node)) {
    if (SKIP_KEYS.has(key)) continue;
    if (skipBody && key === "body") continue;
    const val = (node as unknown as Record<string, unknown>)[key];
    callbacks.push(...findCallbacksFromValue(val, visited));
  }
  return callbacks;
}

function paramMatchesVarName(param: TSESTree.Parameter, varName: string): boolean {
  if (param.type === "Identifier") {
    return param.name === varName;
  }
  if (param.type === "ObjectPattern" || param.type === "ArrayPattern") {
    const ids = collectIdentifiersInNode(param);
    return ids.includes(varName);
  }
  return false;
}

function isFunctionParam(varName: string, scopeNode: TSESTree.Node): boolean {
  const params = (scopeNode as any).params as TSESTree.Parameter[];
  return params.some((p) => paramMatchesVarName(p, varName));
}

function isLetDeclared(varName: string, scopeNode: TSESTree.Node): boolean {
  const body = (scopeNode as any).body;
  if (!body) return false;

  function isLetIdentifierDecl(decl: TSESTree.VariableDeclarator, name: string): boolean {
    return decl.id.type === "Identifier" && decl.id.name === name;
  }

  function searchNode(node: TSESTree.Node): boolean {
    if (node.type === "VariableDeclaration" && node.kind === "let") {
      for (const decl of node.declarations) {
        if (isLetIdentifierDecl(decl, varName)) {
          return true;
        }
      }
    }
    for (const key of Object.keys(node)) {
      if (key === "parent" || key === "loc" || key === "range") continue;
      const val = (node as unknown as Record<string, unknown>)[key];
      for (const child of collectChildNodes(val)) {
        if (searchNode(child)) return true;
      }
    }
    return false;
  }

  const bodyStmts = body.type === "BlockStatement" ? body.body : [body];
  for (const stmt of bodyStmts) {
    if (searchNode(stmt)) return true;
  }
  return false;
}

function isFunctionScope(node: TSESTree.Node): boolean {
  return (
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression" ||
    node.type === "ArrowFunctionExpression"
  );
}

function isMutableBinding(
  varName: string,
  ifNode: TSESTree.IfStatement,
): boolean {
  let scopeNode: TSESTree.Node | undefined = (ifNode as any).parent;

  while (scopeNode) {
    if (scopeNode.type === "Program") return false;

    if (isFunctionScope(scopeNode)) {
      if (isFunctionParam(varName, scopeNode)) return true;
      if (isLetDeclared(varName, scopeNode)) return true;
    }

    scopeNode = (scopeNode as any).parent;
  }
  return false;
}

function typeIncludesNullable(
  type: ts.Type,
  checker: ts.TypeChecker,
): boolean {
  const allTypes = type.isUnion() ? type.types : [type];
  for (const member of allTypes) {
    const typeName = checker.typeToString(member);
    if (typeName === "null" || typeName === "undefined") {
      return true;
    }
  }
  return false;
}

const SKIP_KEYS = new Set(["parent", "loc", "range"]);

function isNode(val: unknown): val is TSESTree.Node {
  return typeof val === "object" && val !== null && "type" in val;
}

function findIdentifierInNode(
  n: TSESTree.Node,
  varName: string,
): TSESTree.Identifier | null {
  if (n.type === "Identifier" && n.name === varName) {
    return n;
  }
  return searchChildrenForIdentifier(n, varName);
}

function searchChildrenForIdentifier(
  n: TSESTree.Node,
  varName: string,
): TSESTree.Identifier | null {
  if (
    n.type === "FunctionDeclaration" ||
    n.type === "FunctionExpression" ||
    n.type === "ArrowFunctionExpression"
  ) {
    return null;
  }
  for (const key of Object.keys(n)) {
    if (SKIP_KEYS.has(key)) continue;
    const val = (n as unknown as Record<string, unknown>)[key];

    const found = searchValueForIdentifier(val, varName);
    if (found) return found;
  }
  return null;
}

function searchValueForIdentifier(
  val: unknown,
  varName: string,
): TSESTree.Identifier | null {
  if (!val || typeof val !== "object") return null;

  if (Array.isArray(val)) {
    return searchArrayForIdentifier(val, varName);
  }

  if (isNode(val)) {
    return findIdentifierInNode(val, varName);
  }

  return null;
}

function searchArrayForIdentifier(
  arr: unknown[],
  varName: string,
): TSESTree.Identifier | null {
  for (const item of arr) {
    if (isNode(item)) {
      const found = findIdentifierInNode(item, varName);
      if (found) return found;
    }
  }
  return null;
}

function extractCbParamNames(
  params: TSESTree.Parameter[],
): string[] {
  return params.flatMap((p) => {
    if (p.type === "Identifier") return [p.name];
    if (
      p.type === "ObjectPattern" ||
      p.type === "ArrayPattern"
    ) {
      return collectIdentifiersInNode(p);
    }
    return [];
  });
}

function reportNarrowingInCallback(
  callback: TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression,
  varName: string,
  ifNode: TSESTree.IfStatement,
  context: Parameters<ReturnType<typeof createRule>["create"]>[0],
) {
  const cbBody =
    callback.body.type === "BlockStatement"
      ? callback.body.body
      : [callback.body];

  const identifiers = cbBody.flatMap((stmt) =>
    collectIdentifiersInNode(stmt),
  );

  if (!identifiers.includes(varName)) return;

  const cbParams = extractCbParamNames(callback.params);
  if (cbParams.includes(varName)) return;

  if (!isMutableBinding(varName, ifNode)) return;

  for (const stmt of cbBody) {
    const idNode = findIdentifierInNode(stmt, varName);
    if (!idNode) continue;

    context.report({
      node: idNode,
      messageId: "narrowingLost",
      data: { varName, url: URL },
    });
    break;
  }
}

function handleIfStatement(
  ifNode: TSESTree.IfStatement,
  context: Parameters<ReturnType<typeof createRule>["create"]>[0],
  checker: ts.TypeChecker,
) {
  const narrowing = isNarrowingTest(ifNode.test);
  if (!narrowing) return;

  const { varName, varNode } = narrowing;

  if (ifNode.consequent?.type !== "BlockStatement") return;

  const parserServices = ESLintUtils.getParserServices(context);
  const tsVarNode = parserServices.esTreeNodeToTSNodeMap.get(varNode);
  if (!tsVarNode) return;

  const varType = checker.getTypeAtLocation(tsVarNode);
  if (!typeIncludesNullable(varType, checker)) return;

  const callbacks = findCallbacks(ifNode.consequent);

  for (const callback of callbacks) {
    reportNarrowingInCallback(callback, varName, ifNode, context);
  }
}

export default createRule({
  name: "no-narrowing-lost-in-callback",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow using a mutable variable inside a callback after narrowing it, because the narrowing is lost as the variable could be reassigned",
     },
    messages: {
      narrowingLost:
        "The variable '{{varName}}' is narrowed outside the callback but may be reassigned before the callback executes. Assign to a 'const' inside the narrowed scope before using it in the callback. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"narrowingLost", []>) {
    const parserServices = ESLintUtils.getParserServices(context);
    const program = parserServices.program;
    if (!program) return {};

    const checker = program.getTypeChecker();

    return {
      IfStatement(ifNode) {
        handleIfStatement(ifNode, context, checker);
      },
    };
  },
});
