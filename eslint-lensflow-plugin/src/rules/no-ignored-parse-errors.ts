import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

const URL = knowledgeUrl("usecases/UC19-serialization.md");

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
        "Calling .parse() without try/catch can crash on invalid input. Use .safeParse() or wrap in try/catch. See: {{url}}",
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

    const isAllowedReceiver = (obj: TSESTree.Node) => {
      if (obj.type !== "Identifier") return false;
      return BUILT_IN_RECEIVERS.has(obj.name) || allowedReceivers.has(obj.name);
    };

    const isInsideTryCatch = (node: TSESTree.Node) => {
      const ancestors = context.sourceCode.getAncestors(node);
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
          if (!inCatch) return true;
          inCatch = false;
        }
      }
      return false;
    };

    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== "MemberExpression") return;
        if (callee.property.type !== "Identifier") return;

        if (callee.property.name !== "parse") return;
        if (isAllowedReceiver(callee.object)) return;

        if (!isInsideTryCatch(node)) {
          context.report({
            node,
            messageId: "unhandledParse",
            data: { url: URL },
          });
        }
      },
    };
  },
});
