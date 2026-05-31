import type { TSESTree } from "@typescript-eslint/types";
import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

const DUPLICATE_CHECK_METHODS = new Set([
  "has",
  "includes",
  "indexOf",
  "hasOwnProperty",
]);

function isPushCall(callee: TSESTree.CallExpression["callee"]): boolean {
  return (
    callee.type === "MemberExpression" &&
    callee.property.type === "Identifier" &&
    callee.property.name === "push"
  );
}

function isDuplicateCheckCall(
  callee: TSESTree.CallExpression["callee"],
): boolean {
  if (callee.type === "MemberExpression") {
    return (
      callee.property.type === "Identifier" &&
      DUPLICATE_CHECK_METHODS.has(callee.property.name)
    );
  }
  if (callee.type === "Identifier") {
    return DUPLICATE_CHECK_METHODS.has(callee.name);
  }
  return false;
}

function analyzeStatement(stmt: TSESTree.Statement): {
  hasPush: boolean;
  hasDuplicateCheck: boolean;
} {
  if (stmt.type === "IfStatement" || stmt.type === "ThrowStatement") {
    return { hasPush: false, hasDuplicateCheck: true };
  }

  if (
    stmt.type === "ExpressionStatement" &&
    stmt.expression.type === "CallExpression"
  ) {
    const callee = stmt.expression.callee;
    const push = isPushCall(callee);
    const check = isDuplicateCheckCall(callee);
    return { hasPush: push, hasDuplicateCheck: check };
  }

  return { hasPush: false, hasDuplicateCheck: false };
}

export default createRule({
  name: "no-unbounded-plugin-registration",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallows plugin registration methods that push to an array without checking for duplicates.",
    },
    messages: {
      unboundedRegister:
        "Plugin registration pushes without duplicate check. Use a Map or Set with a .has() guard before inserting. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/usecases/UC14-extensibility.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"unboundedRegister", []>) {
    return {
      MethodDefinition(node) {
        const methodName =
          node.key.type === "Identifier" ? node.key.name : null;
        if (methodName !== "register") return;

        const body = node.value.body;
        if (body?.type !== "BlockStatement") return;

        let hasPush = false;
        let hasDuplicateCheck = false;

        for (const stmt of body.body) {
          const result = analyzeStatement(stmt);
          hasPush = hasPush || result.hasPush;
          hasDuplicateCheck = hasDuplicateCheck || result.hasDuplicateCheck;
        }

        if (hasPush && !hasDuplicateCheck) {
          context.report({
            node: node.value,
            messageId: "unboundedRegister",
          });
        }
      },
    };
  },
});
