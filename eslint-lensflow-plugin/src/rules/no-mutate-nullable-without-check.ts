import ts from "typescript";
import { ESLintUtils, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("usecases/UC16-nullability.md");

function getObjAndProp(node: unknown): { obj: unknown; prop: string } | null {
  if (!node || typeof node !== "object" || !("type" in node)) return null;
  const n = node as { type: string; object?: unknown; property?: unknown };
  if (n.type !== "MemberExpression") return null;
  const prop = n.property as { type?: string; name?: string; value?: string };
  if (prop.type === "Identifier" && prop.name) {
    return { obj: n.object, prop: prop.name };
  }
  if (prop.type === "Literal" && typeof prop.value === "string") {
    return { obj: n.object, prop: prop.value };
  }
  return null;
}

function nonNullExprMatchesTarget(
  expr: unknown,
  objName: string,
  propName: string,
): boolean {
  const info = getObjAndProp(expr);
  if (
    info &&
    (info.obj as { type?: string; name?: string }).type === "Identifier" &&
    (info.obj as { name?: string }).name === objName &&
    info.prop === propName
  ) {
    return true;
  }
  if ((expr as { type?: string }).type === "ChainExpression") {
    return chainExpressionMatchesTarget(
      (expr as { expression?: unknown }).expression,
      objName,
      propName,
    );
  }
  return false;
}

function chainExpressionMatchesTarget(
  chain: unknown,
  objName: string,
  propName: string,
): boolean {
  if (!chain || typeof chain !== "object") return false;
  const c = chain as { type?: string; object?: unknown; property?: unknown };
  if (c.type !== "MemberExpression") return false;
  const obj = c.object as { type?: string; name?: string };
  if (obj.type !== "Identifier" || obj.name !== objName) return false;
  const prop = c.property as { type?: string; name?: string };
  return prop.type === "Identifier" && prop.name === propName;
}

function pushChildNodes(
  stack: unknown[],
  node: object,
  visited: WeakSet<object>,
): void {
  for (const k of Object.keys(node)) {
    if (k === "parent") continue;
    const child = (node as Record<string, unknown>)[k];
    pushChildOrArray(stack, child, visited);
  }
}

function pushChildOrArray(
  stack: unknown[],
  child: unknown,
  visited: WeakSet<object>,
): void {
  if (!child || typeof child !== "object") return;
  if (Array.isArray(child)) {
    for (const item of child) {
      if (
        item &&
        typeof item === "object" &&
        "type" in item &&
        !visited.has(item)
      ) {
        stack.push(item);
      }
    }
  } else if ("type" in child && !visited.has(child)) {
    stack.push(child);
  }
}

function hasNonNullAssertionInRhs(
  rhs: unknown,
  objName: string,
  propName: string,
): boolean {
  const visited = new WeakSet<object>();
  const stack: unknown[] = [rhs];
  while (stack.length) {
    const n = stack.pop();
    if (!n || typeof n !== "object" || visited.has(n) || !("type" in n))
      continue;
    visited.add(n);
    if (
      (n as { type: string }).type === "TSNonNullExpression" &&
      nonNullExprMatchesTarget(
        (n as { expression?: unknown }).expression,
        objName,
        propName,
      )
    ) {
      return true;
    }
    pushChildNodes(stack, n as object, visited);
  }
  return false;
}

function isBoundaryType(type: string): boolean {
  return (
    type === "FunctionDeclaration" ||
    type === "FunctionExpression" ||
    type === "ArrowFunctionExpression" ||
    type === "ClassBody" ||
    type === "Program"
  );
}

function stmtBlockContainsNode(stmt: unknown, node: unknown): boolean {
  return (
    stmt === node ||
    (typeof stmt === "object" &&
      stmt != null &&
      "type" in stmt &&
      (stmt as { type: string }).type === "BlockStatement" &&
      bodyOfBlockContains(stmt, node))
  );
}

function nullGuardIfContainsNode(
  stmt: unknown,
  node: unknown,
  objName: string,
  propName: string,
): boolean {
  if (typeof stmt !== "object" || stmt == null || !("type" in stmt))
    return false;
  const s = stmt as {
    type: string;
    test?: unknown;
    consequent?: unknown;
    alternate?: unknown;
  };
  if (s.type !== "IfStatement" || !s.test) return false;
  if (!matchesNullCheck(s.test, objName, propName)) return false;
  if (s.consequent && bodyOfBlockContains(s.consequent, node)) return false;
  if (s.alternate && bodyOfBlockContains(s.alternate, node)) return false;
  return true;
}

function isTerminatingStatement(stmt: unknown): boolean {
  if (!stmt || typeof stmt !== "object" || !("type" in stmt)) return false;
  const s = stmt as { type: string; body?: unknown[] };
  if (s.type === "ReturnStatement" || s.type === "ThrowStatement") return true;
  if (s.type === "BlockStatement") {
    const stmts = s.body || [];
    return stmts.length > 0 && isTerminatingStatement(stmts[stmts.length - 1]);
  }
  return false;
}

function isTerminatingNullGuard(
  stmt: unknown,
  objName: string,
  propName: string,
): boolean {
  if (!stmt || typeof stmt !== "object" || !("type" in stmt)) return false;
  const s = stmt as { type: string; test?: unknown; consequent?: unknown };
  if (s.type !== "IfStatement" || !s.test) return false;
  if (!matchesNullCheck(s.test, objName, propName)) return false;
  return isTerminatingStatement(s.consequent);
}

const LOOP_TYPES = new Set([
  "ForStatement",
  "WhileStatement",
  "DoWhileStatement",
  "ForInStatement",
  "ForOfStatement",
]);

function loopHasTerminatingGuard(
  stmt: unknown,
  objName: string,
  propName: string,
): boolean {
  if (!stmt || typeof stmt !== "object" || !("type" in stmt)) return false;
  const s = stmt as { type: string; body?: unknown };
  if (!LOOP_TYPES.has(s.type)) return false;
  const body = s.body;
  if (!body || typeof body !== "object" || !("type" in body)) return false;
  if ((body as { type: string }).type !== "BlockStatement") return false;
  const stmts = (body as unknown as { body: unknown[] }).body;
  return stmts.some((inner) =>
    isTerminatingNullGuard(inner, objName, propName),
  );
}

function stmtIsTerminatingGuard(
  stmt: unknown,
  node: unknown,
  objName: string,
  propName: string,
): boolean {
  return (
    stmtBlockContainsNode(stmt, node) ||
    nullGuardIfContainsNode(stmt, node, objName, propName) ||
    loopHasTerminatingGuard(stmt, objName, propName)
  );
}

function childPassesGuard(
  child: unknown,
  node: unknown,
  objName: string,
  propName: string,
): boolean {
  if (child == null) return true;
  return checkBlockForGuard(child, node, objName, propName);
}

function checkNestedStmt(
  stmt: unknown,
  node: unknown,
  objName: string,
  propName: string,
): boolean {
  if (typeof stmt !== "object" || stmt == null || !("type" in stmt))
    return true;
  const s = stmt as {
    type: string;
    consequent?: unknown;
    alternate?: unknown;
    body?: unknown;
  };

  if (s.type === "IfStatement") {
    if (!childPassesGuard(s.consequent, node, objName, propName)) return false;
    if (!childPassesGuard(s.alternate, node, objName, propName)) return false;
  }
  if (LOOP_TYPES.has(s.type) || s.type === "SwitchStatement") {
    if (!childPassesGuard(s.body, node, objName, propName)) return false;
  }
  return true;
}

function checkBlockForGuard(
  body: unknown,
  node: unknown,
  objName: string,
  propName: string,
): boolean {
  if (!body || typeof body !== "object" || !("type" in body)) return true;
  if ((body as { type: string }).type !== "BlockStatement") return true;
  const stmts = (body as unknown as { body: unknown[] }).body;
  for (const stmt of stmts) {
    if (stmtIsTerminatingGuard(stmt, node, objName, propName)) return false;
    if (!checkNestedStmt(stmt, node, objName, propName)) return false;
  }
  return true;
}

function ifAncestorHasNullGuard(
  stmt: unknown,
  node: unknown,
  objName: string,
  propName: string,
): boolean {
  const s = stmt as {
    test?: unknown;
    consequent?: unknown;
    alternate?: unknown;
  };
  if (
    matchesNullCheck(s.test, objName, propName) &&
    s.consequent &&
    bodyOfBlockContains(s.consequent, node)
  ) {
    return true;
  }
  const body = s.consequent;
  if (!checkBlockForGuard(body, node, objName, propName)) return true;
  return false;
}

function hasNullGuardBefore(
  ancestors: unknown[],
  node: unknown,
  objName: string,
  propName: string,
): boolean {
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const current = ancestors[i];
    if (!current || typeof current !== "object" || !("type" in current))
      continue;
    const cur = current as { type: string; consequent?: unknown };
    if (isBoundaryType(cur.type)) break;
    if (cur.type === "IfStatement") {
      if (ifAncestorHasNullGuard(cur, node, objName, propName)) return true;
    } else if (cur.type === "BlockStatement") {
      if (!checkBlockForGuard(current, node, objName, propName)) return true;
    }
  }
  return false;
}

function bodyOfBlockContains(block: unknown, target: unknown): boolean {
  if (block === target) return true;
  if (!block || typeof block !== "object" || !("type" in block)) return false;
  const b = block as {
    type: string;
    consequent?: unknown;
    alternate?: unknown;
    body?: unknown[];
  };
  if (b.type === "BlockStatement" || b.type === "IfStatement") {
    const body = b.type === "IfStatement" ? b.consequent || b.alternate : block;
    if (
      body &&
      typeof body === "object" &&
      "type" in body &&
      (body as { type: string }).type === "BlockStatement"
    ) {
      for (const stmt of (body as unknown as { body: unknown[] }).body || []) {
        if (bodyOfBlockContains(stmt, target)) return true;
      }
    }
  }
  return false;
}

function isNullishValue(node: unknown): boolean {
  const n = node as { type?: string; value?: unknown; name?: string };
  return (
    (n.type === "Literal" && (n.value === null || n.value === undefined)) ||
    (n.type === "Identifier" && n.name === "undefined")
  );
}

function objMatchesName(
  info: { obj: unknown; prop: string },
  objName: string,
  propName: string,
): boolean {
  const obj = info.obj as { type?: string; name?: string };
  return (
    obj.type === "Identifier" && obj.name === objName && info.prop === propName
  );
}

function isNullComparisonOperator(op?: string): boolean {
  return ["===", "==", "!==", "!="].includes(op as string);
}

function matchesBinaryNullCheck(
  t: { type: string; left?: unknown; right?: unknown; operator?: string },
  objName: string,
  propName: string,
): boolean {
  if (t.type !== "BinaryExpression") return false;
  if (!isNullComparisonOperator(t.operator)) return false;

  const leftInfo = getObjAndProp(t.left);
  const rightInfo = getObjAndProp(t.right);

  if (
    leftInfo &&
    objMatchesName(leftInfo, objName, propName) &&
    isNullishValue(t.right)
  ) {
    return true;
  }
  if (
    rightInfo &&
    objMatchesName(rightInfo, objName, propName) &&
    isNullishValue(t.left)
  ) {
    return true;
  }
  return false;
}

function matchesUnaryNullCheck(
  t: { type: string; operator?: string; argument?: unknown },
  objName: string,
  propName: string,
): boolean {
  if (t.type !== "UnaryExpression" || t.operator !== "!") return false;
  const info = getObjAndProp(t.argument);
  return info != null && objMatchesName(info, objName, propName);
}

function matchesNullCheck(
  test: unknown,
  objName: string,
  propName: string,
): boolean {
  if (!test || typeof test !== "object" || !("type" in test)) return false;
  const t = test as {
    type: string;
    left?: unknown;
    right?: unknown;
    operator?: string;
    argument?: unknown;
  };
  if (matchesBinaryNullCheck(t, objName, propName)) return true;
  if (matchesUnaryNullCheck(t, objName, propName)) return true;
  return false;
}

export default createRule({
  name: "no-mutate-nullable-without-check",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow mutating a nullable property without first checking for null/undefined",
    },
    messages: {
      mutateNullableWithoutCheck: `Mutating nullable property '{{objName}}.{{propName}}' without a prior null check. Add a guard before mutating. See: {{url}}`,
    },
    schema: [],
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"mutateNullableWithoutCheck", []>) {
    const parserServices = ESLintUtils.getParserServices(context);
    const program = parserServices.program;
    if (!program) return {};

    const checker = program.getTypeChecker();

    return {
      AssignmentExpression(node) {
        if (node.left.type !== "MemberExpression") return;
        const left = node.left;
        const info = getObjAndProp(left);
        if (!info) return;
        if ((info.obj as { type?: string }).type !== "Identifier") return;
        const objName = (info.obj as { name?: string }).name!;
        const propName = info.prop;

        const leftTs = parserServices.esTreeNodeToTSNodeMap.get(left);
        if (!leftTs) return;

        const lhsType = checker.getTypeAtLocation(leftTs as ts.Expression);
        const constituents = (lhsType as ts.UnionType).types || [lhsType];

        const includesNull = constituents.some((t) => {
          const typeName = checker.typeToString(t);
          return typeName === "null" || typeName === "undefined";
        });
        if (!includesNull) return;

        const rhs = node.right;
        if (!hasNonNullAssertionInRhs(rhs, objName, propName)) return;

        if (
          !hasNullGuardBefore(
            context.sourceCode.getAncestors(node),
            node,
            objName,
            propName,
          )
        ) {
          context.report({
            node,
            messageId: "mutateNullableWithoutCheck",
            data: { objName, propName, url: URL },
          });
        }
      },
    };
  },
});
