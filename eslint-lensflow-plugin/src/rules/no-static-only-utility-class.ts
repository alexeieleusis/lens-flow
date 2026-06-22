import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "no-static-only-utility-class",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow classes that have a private constructor, no instance fields, and only static methods — these are unnecessary wrappers for plain utility functions.",
    },
    messages: {
      staticOnlyUtility:
        "Class {{name}} has a private constructor, no instance fields, and only static methods. Replace with plain utility functions in a module namespace. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC10-encapsulation.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"staticOnlyUtility", []>) {
    return {
      ClassBody(node) {
        const members = node.body;

        const hasPrivateConstructor = members.some(
          (member) =>
            member.type === "MethodDefinition" &&
            member.kind === "constructor" &&
            member.key.type === "Identifier" &&
            member.key.name === "constructor" &&
            member.accessibility === "private",
        );

        const hasInstanceFields = members.some(
          (member) => member.type === "PropertyDefinition",
        );

        const nonConstructorMethods = members.filter(
          (member) =>
            member.type === "MethodDefinition" &&
            member.kind !== "constructor",
        );

        const allNonConstructorAreStatic =
          nonConstructorMethods.length > 0 &&
          nonConstructorMethods.every((m) => m.type === "MethodDefinition" && m.static === true);

        if (
          hasPrivateConstructor &&
          !hasInstanceFields &&
          allNonConstructorAreStatic
        ) {
          const className =
            node.parent && "id" in node.parent && node.parent.id
              ? node.parent.id.name
              : "Unknown";

          context.report({
            node: node.parent,
            messageId: "staticOnlyUtility",
            data: { name: className },
          });
        }
      },
    };
  },
});
