import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { walkNodes } from "../utils/ast-helpers.js";

function isPrivateFieldReturn(expr: TSESTree.Node | null | undefined): boolean {
  if (expr?.type !== "MemberExpression") return false;
  if (expr.object.type !== "ThisExpression") return false;
  if (expr.property.type === "PrivateIdentifier") return true;
  return (
    expr.property.type === "Identifier" &&
    expr.property.name.startsWith("#")
  );
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
        'Getter "{{getterName}}" returns a #private field directly, leaking mutable internal state. Return a copy or an immutable view instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC10-encapsulation.md',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"leaksPrivateField", []>) {
    return {
      MethodDefinition(node) {
        if (node.kind !== "get") return;

        const getterName =
          node.key.type === "Identifier" ? node.key.name : "<anonymous>";

        if (!node.value?.body) return;

        const found = walkNodes(
          node.value.body,
          (n) =>
            n.type === "ReturnStatement" &&
            n.argument != null &&
            isPrivateFieldReturn(n.argument),
        );

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
