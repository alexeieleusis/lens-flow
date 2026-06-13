import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "no-ignored-parse-errors",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow calling .parse() without try/catch or using .safeParse() instead",
    },
    messages: {
      unhandledParse:
        "Calling .parse() without try/catch can crash on invalid input. Use .safeParse() or wrap in try/catch. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/usecases/UC19-serialization.md",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"unhandledParse", []>) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== "MemberExpression") return;
        if (callee.property.type !== "Identifier") return;

        const methodName = callee.property.name;
        if (methodName !== "parse") return;

        let hasTryCatch = false;
        let ancestor: unknown = node.parent;
        while (ancestor) {
          if (
            (ancestor as { type: string }).type === "TryStatement" ||
            (ancestor as { type: string }).type === "CatchClause"
          ) {
            hasTryCatch = true;
            break;
          }
          ancestor = (ancestor as { parent?: unknown }).parent;
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
