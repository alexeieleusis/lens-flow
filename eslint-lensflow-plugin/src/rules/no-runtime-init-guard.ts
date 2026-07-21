import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

const URL = knowledgeUrl("catalog/T57-typestate.md");

export default createRule({
  name: "no-runtime-init-guard",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow runtime null/falsy checks with throw to enforce required initialization; use typestate instead",
    },
    messages: {
      runtimeInitGuard:
        "Runtime null check with throw to enforce initialization should be a compile-time type error via typestate. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"runtimeInitGuard", []>) {
    return {
      IfStatement(node) {
        const ancestors = context.sourceCode.getAncestors(node);
        const methodContext = findEnclosingMethod(ancestors);
        if (!methodContext) return;

        const throwInfo = extractThrowInfo(node);
        if (!throwInfo) return;

        const { throwStmt, throwInAlternate } = throwInfo;

        if (!isErrorConstructor(throwStmt)) return;

        const target = extractTestTarget(node, throwInAlternate);
        if (!target) return;

        if (!isThisMemberExpression(target)) return;

        context.report({
          node,
          messageId: "runtimeInitGuard",
          data: { url: URL },
        });
      },
    };
  },
});

function findEnclosingMethod(ancestors: TSESTree.Node[]) {
  let enclosingFnIndex = -1;
  for (let i = ancestors.length - 1; i >= 0; i--) {
    if (isFunctionNode(ancestors[i])) {
      enclosingFnIndex = i;
      break;
    }
  }
  if (enclosingFnIndex < 0) return null;

  const parent = ancestors[enclosingFnIndex - 1];
  if (!parent) return null;

  if (parent.type === "MethodDefinition") return { parent };
  if (parent.type === "PropertyDefinition") {
    const valType = parent.value?.type;
    if (
      valType === "ArrowFunctionExpression" ||
      valType === "FunctionExpression"
    ) {
      return { parent };
    }
  }
  return null;
}

function isFunctionNode(node: TSESTree.Node): boolean {
  return (
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression" ||
    node.type === "ArrowFunctionExpression"
  );
}

function extractThrowInfo(
  node: TSESTree.IfStatement,
): { throwStmt: TSESTree.ThrowStatement; throwInAlternate: boolean } | null {
  if (node.consequent.type === "ThrowStatement") {
    return { throwStmt: node.consequent, throwInAlternate: false };
  }

  if (!node.alternate) return null;

  if (node.alternate.type === "ThrowStatement") {
    return { throwStmt: node.alternate, throwInAlternate: true };
  }

  if (
    node.alternate.type === "BlockStatement" &&
    node.alternate.body.length === 1 &&
    node.alternate.body[0].type === "ThrowStatement"
  ) {
    return { throwStmt: node.alternate.body[0], throwInAlternate: true };
  }

  return null;
}

function isErrorConstructor(throwStmt: TSESTree.ThrowStatement): boolean {
  const thrown = throwStmt.argument;
  if (thrown?.type !== "NewExpression") return false;

  const callee = thrown.callee;
  return callee.type === "Identifier" && /^Error$/.test(callee.name);
}

function extractTestTarget(
  node: TSESTree.IfStatement,
  throwInAlternate: boolean,
): TSESTree.Node | null {
  if (node.test.type === "UnaryExpression" && node.test.operator === "!") {
    return node.test.argument;
  }
  if (throwInAlternate && node.test.type === "MemberExpression") {
    return node.test;
  }
  return null;
}

function isThisMemberExpression(node: TSESTree.Node): boolean {
  return (
    node.type === "MemberExpression" && node.object.type === "ThisExpression"
  );
}
