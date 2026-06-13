import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

function isPrivateFieldReturn(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  const n = node as Record<string, unknown>;

  if (
    n.type === "MemberExpression" &&
    (n.object as Record<string, unknown>)?.type === "ThisExpression" &&
    ((n.property as Record<string, unknown>)?.type === "PrivateIdentifier" ||
      ((n.property as Record<string, unknown>)?.type === "Identifier" &&
        typeof (n.property as Record<string, unknown>).name === "string" &&
        ((n.property as Record<string, unknown>).name as string).startsWith("#")))
  ) {
    return true;
  }

  return false;
}

export default createRule({
  name: "no-getter-returns-private-field",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow getters that return #private fields directly, which leaks mutable internal state",
    },
    messages: {
      leaksPrivateField:
        "Getter \"{{getterName}}\" returns a #private field directly, leaking mutable internal state. Return a copy or an immutable view instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/usecases/UC10-encapsulation.md",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"leaksPrivateField", []>) {
    function checkChild(child: unknown): boolean {
      if (Array.isArray(child)) {
        for (const item of child) {
          if (findReturnWithPrivateField(item)) return true;
        }
      } else if (child && typeof child === "object" && !Array.isArray(child)) {
        if (findReturnWithPrivateField(child)) return true;
      }
      return false;
    }

    function findReturnWithPrivateField(node: unknown): boolean {
      if (!node || typeof node !== "object") return false;
      const n = node as Record<string, unknown>;

      if (
        n.type === "ReturnStatement" &&
        n.argument &&
        isPrivateFieldReturn(n.argument)
      ) {
        return true;
      }

      const skipKeys = new Set(["parent", "loc", "range"]);
      for (const [key, child] of Object.entries(n)) {
        if (!skipKeys.has(key) && checkChild(child)) return true;
      }

      return false;
    }

    return {
      MethodDefinition(node) {
        if (node.kind !== "get") return;

        const getterName =
          node.key.type === "Identifier" ? node.key.name : "<anonymous>";

        if (!node.value?.body) return;

        const found = findReturnWithPrivateField(node.value.body);
        if (found) {
          context.report({
            node,
            messageId: "leaksPrivateField",
            data: { getterName },
          });
        }
      },
    };
  },
});
