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

        const info = collectSiblingIfChain(node);
        if (!info) return;

        if (info.handledValues.length === 0) return;

        if (nodeHasAssertNeverOrThrow(node)) return;

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
    if (isFunctionBody(cur)) {
      const idx = cur.body.indexOf(returnNode);
      if (idx >= 0) return { body: cur, index: idx };
    }
    cur = cur.parent;
  }
  return null;
}

function isFunctionBody(node: TSESTree.Node): node is TSESTree.BlockStatement {
  if (node.type !== "BlockStatement" || !node.parent) return false;
  const pType = node.parent.type;
  return (
    pType === "FunctionDeclaration" ||
    pType === "FunctionExpression" ||
    pType === "ArrowFunctionExpression"
  );
}

function collectBackwardsIfChain(
  funcBody: TSESTree.BlockStatement,
  startIndex: number,
): { varName: string | null; propName: string | null; handledValues: (string | number)[] } {
  let varName: string | null = null;
  let propName: string | null = null;
  const handledValues: (string | number)[] = [];

  for (let i = startIndex - 1; i >= 0; i--) {
    const stmt = funcBody.body[i];
    if (!isChainableIf(stmt)) break;

    const disc = extractBinaryDiscriminant(
      stmt.test as TSESTree.BinaryExpression,
    );
    if (!disc) break;
    if (varName && (disc.varName !== varName || disc.propName !== propName)) break;

    varName = disc.varName;
    propName = disc.propName;
    handledValues.push(disc.value);
  }

  handledValues.reverse();
  return { varName, propName, handledValues };
}

function isChainableIf(stmt: TSESTree.Node): stmt is TSESTree.IfStatement {
  if (stmt.type !== "IfStatement") return false;
  if (stmt.test.type !== "BinaryExpression") return false;
  return stmt.test.operator === "===" || stmt.test.operator === "!==";
}

function extractBinaryDiscriminant(
  test: TSESTree.BinaryExpression,
): { varName: string; propName: string | null; value: string | number } | null {
  if (
    test.left.type === "MemberExpression" &&
    test.left.property.type === "Identifier" &&
    test.left.object.type === "Identifier"
  ) {
    const value = getLiteralFromExpr(test.right);
    if (value === null || typeof value === "boolean") return null;
    return {
      varName: test.left.object.name,
      propName: test.left.property.name,
      value,
    };
  }
  if (test.left.type === "Identifier") {
    const value = getLiteralFromExpr(test.right);
    if (value === null || typeof value === "boolean") return null;
    return { varName: test.left.name, propName: null, value };
  }
  if (
    test.right.type === "MemberExpression" &&
    test.right.property.type === "Identifier" &&
    test.right.object.type === "Identifier"
  ) {
    const value = getLiteralFromExpr(test.left);
    if (value === null || typeof value === "boolean") return null;
    return {
      varName: test.right.object.name,
      propName: test.right.property.name,
      value,
    };
  }
  if (test.right.type === "Identifier") {
    const value = getLiteralFromExpr(test.left);
    if (value === null || typeof value === "boolean") return null;
    return { varName: test.right.name, propName: null, value };
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
  for (const param of func.params) {
    if (param.type === "Identifier" && param.name === paramName) return param;
  }
  return null;
}
