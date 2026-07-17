import ts from "typescript";
import { ESLintUtils, type TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import {
  nodeHasAssertNeverOrThrow,
  getLiteralFromExpr,
} from "../utils/ast-helpers.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import {
  extractLiteralValues,
  checkSwitchExhaustiveness,
} from "../utils/ts-helpers.js";

const DISCRIMINANT_DOC_URL = knowledgeUrl("usecases/UC13-state-machines.md");

interface IfChainInfo {
  discriminantVar: string;
  discriminantProp: string | null;
  handledValues: (string | number)[];
}

export default createRule({
  name: "require-exhaustive-never-check",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require exhaustive never checks in switch and if-else chains over discriminated unions",
    },
    messages: {
      switchMissingNeverCheck:
        "Switch statement has unhandled variants ({{missing}}) without a never-assertion in the default branch. Add a default case with assertNever or throw. See: {{url}}",
      ifChainMissingNeverCheck:
        "If-else chain on discriminated union has unhandled variants ({{missing}}) without a never-assertion fallback. The final branch returns a literal value instead of calling assertNever. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"ifChainMissingNeverCheck" | "switchMissingNeverCheck", []>) {
    const parserServices = ESLintUtils.getParserServices(context);
    const program = parserServices.program;
    if (!program) return {};

    const checker = program.getTypeChecker();

    return {
      SwitchStatement(node) {
        const tsDiscriminant =
          parserServices.esTreeNodeToTSNodeMap.get(node.discriminant);
        if (!tsDiscriminant) return;

        checkSwitchExhaustiveness(
          node,
          checker,
          tsDiscriminant,
          context,
          "switchMissingNeverCheck",
          DISCRIMINANT_DOC_URL,
        );
      },

      ReturnStatement(node) {
        if (!node.argument) return;

        let parent: TSESTree.Node | undefined = node.parent;
        while (parent) {
          if (parent.type === "SwitchCase") return;
          parent = parent.parent;
        }

        const funcInfo = findContainingFunctionBody(node);
        if (!funcInfo) return;

        const ifAncestor = findIfAncestorInBody(node, funcInfo.body);
        if (ifAncestor) {
          if (funcInfo.body.body[funcInfo.body.body.length - 1] !== ifAncestor) return;
        } else if (funcInfo.body.body[funcInfo.body.body.length - 1] !== node) {
          return;
        }

        const info = collectSiblingIfChain(node);
        if (!info) return;

        if (info.handledValues.length === 0) return;

        if (nodeHasAssertNeverOrThrow(node)) return;

        if (ifAncestor && hasGuardElse(ifAncestor)) return;

        const allValues = getAllDiscriminantValues(
          node,
          info,
          parserServices,
          checker,
        );
        if (!allValues) return;

        if (allValues.length < 2) return;

        const missing = allValues.filter(
          (v) => !info.handledValues.includes(v),
        );
        if (missing.length === 0) return;

        context.report({
          node,
          messageId: "ifChainMissingNeverCheck",
          data: {
            missing: missing.map(String).join(", "),
            url: DISCRIMINANT_DOC_URL,
          },
        });
      },
    };
  },
});

function collectSiblingIfChain(
  returnNode: TSESTree.ReturnStatement,
): IfChainInfo | null {
  const funcInfo = findContainingFunctionBody(returnNode);
  if (!funcInfo) return null;

  const { varName, propName, handledValues } =
    collectBackwardsIfChain(funcInfo.body, funcInfo.index);

  if (!varName || handledValues.length === 0) return null;

  return {
    discriminantVar: varName,
    discriminantProp: propName,
    handledValues,
  };
}

function findContainingFunctionBody(
  returnNode: TSESTree.ReturnStatement,
): { body: TSESTree.BlockStatement; index: number } | null {
  let cur: TSESTree.Node | undefined = returnNode;
  while (cur) {
    if (
      cur.type === "BlockStatement" &&
      cur.parent &&
      (cur.parent.type === "FunctionDeclaration" ||
        cur.parent.type === "FunctionExpression" ||
        cur.parent.type === "ArrowFunctionExpression")
    ) {
      const idx = cur.body.indexOf(returnNode);
      if (idx >= 0) return { body: cur, index: idx };
      const si = findAncestorStatementIndex(returnNode, cur);
      if (si >= 0) return { body: cur, index: si };
      return null;
    }
    cur = cur.parent;
  }
  return null;
}

function findAncestorStatementIndex(
  returnNode: TSESTree.ReturnStatement,
  funcBody: TSESTree.BlockStatement,
): number {
  let cur: TSESTree.Node | undefined = returnNode;
  while (cur) {
    const idx = funcBody.body.indexOf(cur as TSESTree.Statement);
    if (idx >= 0) return idx;
    cur = cur.parent;
  }
  return -1;
}

function collectBackwardsIfChain(
  funcBody: TSESTree.BlockStatement,
  startIndex: number,
): { varName: string | null; propName: string | null; handledValues: (string | number)[] } {
  let varName: string | null = null;
  let propName: string | null = null;
  const handledValues: (string | number)[] = [];

  const startStmt = funcBody.body[startIndex];
  if (startStmt && isChainableIf(startStmt)) {
    const disc = extractBinaryDiscriminant(
      startStmt.test as TSESTree.BinaryExpression,
    );
    if (disc) {
      varName = disc.varName;
      propName = disc.propName;
      handledValues.push(disc.value);
    }
  }

  for (let i = startIndex - 1; i >= 0; i--) {
    const stmt = funcBody.body[i];
    if (!isChainableIf(stmt)) break;

    const disc = extractBinaryDiscriminant(
      stmt.test as TSESTree.BinaryExpression,
    );
    if (!disc) break;
    if (varName && (disc.varName !== varName || disc.propName !== propName)) break;

    if (!varName) {
      varName = disc.varName;
      propName = disc.propName;
    }
    handledValues.push(disc.value);
  }

  handledValues.reverse();
  return { varName, propName, handledValues };
}

function hasGuardElse(ifStmt: TSESTree.IfStatement): boolean {
  let current = ifStmt;
  while (current) {
    if (!current.alternate) return false;
    const alt = current.alternate;
    if (alt.type === "IfStatement") {
      current = alt;
      continue;
    }
    return nodeHasAssertNeverOrThrow(alt);
  }
  return false;
}

function isChainableIf(stmt: TSESTree.Node): stmt is TSESTree.IfStatement {
  if (stmt.type !== "IfStatement") return false;
  if (stmt.test.type !== "BinaryExpression") return false;
  return stmt.test.operator === "===" || stmt.test.operator === "!==";
}

function extractMemberPath(
  node: TSESTree.MemberExpression,
): { root: TSESTree.Identifier; propName: string } | null {
  if (node.property.type !== "Identifier") return null;
  if (node.object.type === "Identifier") return { root: node.object, propName: node.property.name };
  if (node.object.type === "MemberExpression") {
    const inner = extractMemberPath(node.object);
    return inner ? { root: inner.root, propName: node.property.name } : null;
  }
  return null;
}

function unwrapChain(expr: TSESTree.Expression | TSESTree.PrivateIdentifier): TSESTree.Expression {
  if (expr.type === "ChainExpression") return expr.expression;
  return expr as TSESTree.Expression;
}

function extractLeftMember(
  test: TSESTree.BinaryExpression,
): { varName: string; propName: string; value: string | number | boolean | null } | null {
  const left = unwrapChain(test.left);
  if (left.type !== "MemberExpression" || left.property.type !== "Identifier") return null;
  const path = extractMemberPath(left);
  if (!path) return null;
  const value = getLiteralFromExpr(test.right);
  return { varName: path.root.name, propName: path.propName, value };
}

function extractRightMember(
  test: TSESTree.BinaryExpression,
): { varName: string; propName: string; value: string | number | boolean | null } | null {
  const right = unwrapChain(test.right);
  if (right.type !== "MemberExpression" || right.property.type !== "Identifier") return null;
  const path = extractMemberPath(right);
  if (!path) return null;
  const value = getLiteralFromExpr(test.left);
  return { varName: path.root.name, propName: path.propName, value };
}

function extractBinaryDiscriminant(
  test: TSESTree.BinaryExpression,
): { varName: string; propName: string | null; value: string | number } | null {
  const lm = extractLeftMember(test);
  if (lm && lm.value !== null && typeof lm.value !== "boolean") {
    return { varName: lm.varName, propName: lm.propName, value: lm.value };
  }

  const left = unwrapChain(test.left);
  if (left.type === "Identifier") {
    const value = getLiteralFromExpr(test.right);
    if (value !== null && typeof value !== "boolean") {
      return { varName: left.name, propName: null, value };
    }
  }

  const rm = extractRightMember(test);
  if (rm && rm.value !== null && typeof rm.value !== "boolean") {
    return { varName: rm.varName, propName: rm.propName, value: rm.value };
  }

  const right = unwrapChain(test.right);
  if (right.type === "Identifier") {
    const value = getLiteralFromExpr(test.left);
    if (value !== null && typeof value !== "boolean") {
      return { varName: right.name, propName: null, value };
    }
  }

  return null;
}

function getAllDiscriminantValues(
  returnNode: TSESTree.ReturnStatement,
  info: IfChainInfo,
  parserServices: ReturnType<typeof ESLintUtils.getParserServices>,
  checker: ts.TypeChecker,
): (string | number)[] | null {
  const func = findParentFunction(returnNode);
  if (!func) return null;

  const param = findParamByName(func, info.discriminantVar);
  if (!param) return null;

  const tsNode = parserServices.esTreeNodeToTSNodeMap.get(param);
  if (!tsNode) return null;

  let paramType = checker.getTypeAtLocation(tsNode);

  if (info.discriminantProp) {
    const propSym = checker.getPropertyOfType(paramType, info.discriminantProp);
    if (!propSym) return null;
    paramType = checker.getTypeOfSymbolAtLocation(propSym, tsNode);
  }

  const values = extractLiteralValues(paramType);
  const filtered = values.filter((v): v is string | number => typeof v !== "boolean");
  return filtered.length > 0 ? filtered : null;
}

type FunctionNode =
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression
  | TSESTree.ArrowFunctionExpression;

function findParentFunction(node: TSESTree.Node): FunctionNode | null {
  let current: TSESTree.Node | undefined = node;
  while (current) {
    if (
      current.type === "FunctionDeclaration" ||
      current.type === "FunctionExpression" ||
      current.type === "ArrowFunctionExpression"
    )
      return current as FunctionNode;
    current = current.parent;
  }
  return null;
}

function findParamByName(
  func: FunctionNode,
  paramName: string,
): TSESTree.Identifier | null {
  for (const raw of func.params) {
    const id = extractParamIdentifier(raw, paramName);
    if (id) return id;
  }
  return null;
}

type PatternLike =
  | TSESTree.Identifier
  | TSESTree.ObjectPattern
  | TSESTree.ArrayPattern
  | TSESTree.AssignmentPattern
  | TSESTree.RestElement
  | TSESTree.TSParameterProperty
  | TSESTree.MemberExpression;

function extractParamIdentifier(
  node: PatternLike,
  name: string,
): TSESTree.Identifier | null {
  if (node.type === "Identifier") return node.name === name ? node : null;
  if (node.type === "AssignmentPattern") return extractParamIdentifier(node.left, name);
  if (node.type === "RestElement") return extractParamIdentifier(node.argument, name);
  if (node.type === "TSParameterProperty") return extractParamIdentifier(node.parameter, name);
  if (node.type === "ObjectPattern") return extractFromObjectPattern(node, name);
  if (node.type === "ArrayPattern") return extractFromArrayPattern(node, name);
  return null;
}

function extractFromObjectPattern(
  node: TSESTree.ObjectPattern,
  name: string,
): TSESTree.Identifier | null {
  for (const prop of node.properties) {
    if (prop.type === "Property") {
      if (prop.key.type === "Identifier" && prop.key.name === name) {
        if (prop.value.type === "Identifier") return prop.value;
        if (isPatternLike(prop.value)) return extractParamIdentifier(prop.value, name);
      }
    } else if (prop.type === "RestElement") {
      if (prop.argument.type === "Identifier" && prop.argument.name === name) {
        return prop.argument;
      }
    }
  }
  return null;
}

function extractFromArrayPattern(
  node: TSESTree.ArrayPattern,
  name: string,
): TSESTree.Identifier | null {
  for (const element of node.elements) {
    if (!element) continue;
    if (element.type === "Identifier" && element.name === name) return element;
    if (element.type === "RestElement" && element.argument.type === "Identifier" && element.argument.name === name) {
      return element.argument;
    }
    if (isPatternLike(element)) {
      const nested = extractParamIdentifier(element, name);
      if (nested) return nested;
    }
  }
  return null;
}

function findIfAncestorInBody(
  node: TSESTree.Node,
  funcBody: TSESTree.BlockStatement,
): TSESTree.IfStatement | null {
  let cur: TSESTree.Node | undefined = node.parent;
  while (cur && cur !== funcBody) {
    if (cur.type === "IfStatement") {
      if (funcBody.body.includes(cur as TSESTree.Statement)) return cur;
    }
    cur = cur.parent;
  }
  return null;
}

function isPatternLike(node: TSESTree.Node): node is PatternLike {
  return (
    node.type === "Identifier" ||
    node.type === "ObjectPattern" ||
    node.type === "ArrayPattern" ||
    node.type === "AssignmentPattern" ||
    node.type === "RestElement" ||
    node.type === "TSParameterProperty" ||
    node.type === "MemberExpression"
  );
}
