import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

const BUILT_IN_RECEIVERS = new Set([
  "Date",
  "JSON",
  "Number",
  "String",
  "Boolean",
  "Array",
  "Object",
  "Map",
  "Set",
  "WeakMap",
  "WeakSet",
  "Intl",
  "Math",
  "Reflect",
  "Promise",
  "Symbol",
  "RegExp",
  "Error",
  "Function",
  "Atomics",
  "SharedArrayBuffer",
  "WebAssembly",
]);

type RuleOptions = [{ allowedReceivers?: string[] }];

export default createRule({
  name: "no-ignored-parse-errors",
  meta: {
    fixable: undefined,
    type: "problem",
    docs: {
      description:
        "Disallow calling .parse() on schema validators without try/catch or using .safeParse() instead",
    },
    messages: {
      unhandledParse:
        "Calling .parse() without try/catch can crash on invalid input. Use .safeParse() or wrap in try/catch. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC19-serialization.md",
    },
    schema: [
      {
        type: "object",
        properties: {
          allowedReceivers: {
            type: "array",
            items: { type: "string" },
            description:
              "Receiver names to exclude from this rule (e.g. ['MyParser', 'customParse'])",
          },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [{}],
  create(context: TSESLint.RuleContext<"unhandledParse", RuleOptions>) {
    const [options] = context.options;
    const allowedReceivers = new Set(
      options?.allowedReceivers ?? [],
    );

    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== "MemberExpression") return;
        if (callee.property.type !== "Identifier") return;

        const methodName = callee.property.name;
        if (methodName !== "parse") return;

        const obj = callee.object;
        if (obj.type === "Identifier") {
          if (BUILT_IN_RECEIVERS.has(obj.name)) return;
          if (allowedReceivers.has(obj.name)) return;
        }

        const ancestors = context.sourceCode.getAncestors(node);
        let hasTryCatch = false;
        let inCatch = false;
        for (let i = ancestors.length - 1; i >= 0; i--) {
          const type = ancestors[i].type;

          // Stop at function boundaries — a .parse() inside a nested callback
          // throws outside any outer try/catch scope.
          if (
            type === "FunctionDeclaration" ||
            type === "FunctionExpression" ||
            type === "ArrowFunctionExpression"
          ) {
            break;
          }

          if (type === "CatchClause") {
            inCatch = true;
          } else if (type === "TryStatement") {
            if (!inCatch) {
              hasTryCatch = true;
              break;
            }
            inCatch = false;
          }
        }

        if (!hasTryCatch) {
          context.report({
            node,
            messageId: "unhandledParse",
          });
        }
      },
    };
  },
});
