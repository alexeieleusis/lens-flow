import { createRule } from "../utils/rule-creator.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { getKeys } from "eslint-visitor-keys";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("usecases/UC14-extensibility.md");

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

function collectCallExpressions(node: TSESTree.Node): TSESTree.CallExpression[] {
  const calls: TSESTree.CallExpression[] = [];
  if (node.type === "CallExpression") {
    calls.push(node);
  }

  for (const key of getKeys(node)) {
    const child = (node as any)[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        if (item && typeof item === "object" && "type" in item) {
          calls.push(...collectCallExpressions(item as TSESTree.Node));
        }
      }
    } else if (child && typeof child === "object" && "type" in child) {
      calls.push(...collectCallExpressions(child as TSESTree.Node));
    }
  }

  return calls;
}

function analyzeBody(body: TSESTree.BlockStatement): {
  hasPush: boolean;
  hasDuplicateCheck: boolean;
} {
  const calls = collectCallExpressions(body);
  let hasPush = false;
  let hasDuplicateCheck = false;

  for (const call of calls) {
    if (isPushCall(call.callee)) {
      hasPush = true;
    }
    if (isDuplicateCheckCall(call.callee)) {
      hasDuplicateCheck = true;
    }
  }

  return { hasPush, hasDuplicateCheck };
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
         "Plugin registration pushes without duplicate check. Use a Map or Set with a .has() guard before inserting. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"unboundedRegister", []>) {
    return {
      MethodDefinition(node) {
        let methodName: string | null = null;
        if (node.key.type === "Identifier") {
          methodName = node.key.name;
        } else if (node.key.type === "Literal" && typeof node.key.value === "string") {
          methodName = node.key.value;
        }
        if (methodName !== "register") return;

        const body = node.value.body;
        if (body?.type !== "BlockStatement") return;

        const result = analyzeBody(body);

        if (result.hasPush && !result.hasDuplicateCheck) {
          context.report({
            node: node.value,
            messageId: "unboundedRegister",
            data: {
              url: URL,
            },
          });
        }
      },
      PropertyDefinition(node) {
        let propName: string | null = null;
        if (node.key.type === "Identifier") {
          propName = node.key.name;
        } else if (node.key.type === "Literal" && typeof node.key.value === "string") {
          propName = node.key.value;
        }
        if (propName !== "register") return;

        if (!node.value) return;

        const fn = node.value;
        if (fn.type !== "ArrowFunctionExpression" && fn.type !== "FunctionExpression") return;

        const body = fn.body;
        if (body.type !== "BlockStatement") return;

        const result = analyzeBody(body);

        if (result.hasPush && !result.hasDuplicateCheck) {
          context.report({
            node: node.value,
            messageId: "unboundedRegister",
            data: {
              url: URL,
            },
          });
        }
      },
    };
  },
});
