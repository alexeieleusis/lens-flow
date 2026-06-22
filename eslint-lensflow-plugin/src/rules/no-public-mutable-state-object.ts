import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

const statefulEntityPattern =
  /account|wallet|balance|counter|state|inventory|cart|session|store|registry|pool|cache|buffer|accumulator|collector/i;

function hasMutableStateType(typeAnnotation: any): boolean {
  if (!typeAnnotation) return false;

  const { type } = typeAnnotation;

  if (type === "TSNumberKeyword" || type === "TSStringKeyword") return true;

  if (type === "TSArrayType") return true;

  if (type === "TSUnionType") {
    return typeAnnotation.types.some(
      (t: any) =>
        t.type === "TSNumberKeyword" ||
        t.type === "TSStringKeyword" ||
        t.type === "TSArrayType",
    );
  }

  return false;
}

export default createRule({
  name: "no-public-mutable-state-object",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow plain types or interfaces with mutable numeric, string, or array fields that track state without encapsulation",
    },
    messages: {
      mutableStateObject:
        "{{name}} is a plain {{kind}} with mutable state properties ({{props}}). Use a class with private fields and controlled mutation methods instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC10-encapsulation.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"mutableStateObject", []>) {
    function checkNode(
      members: any[],
      parent: any,
      kind: "interface" | "type",
      parentType: string,
    ) {
      if (parent?.type !== parentType || !parent.id) return;

      const name = parent.id.name;
      if (!statefulEntityPattern.test(name)) return;

      const mutableProps = members.filter(
        (member: any) =>
          member.type === "TSPropertySignature" &&
          !member.readonly &&
          hasMutableStateType(member.typeAnnotation?.typeAnnotation),
      );

      if (mutableProps.length > 0) {
        context.report({
          node: parent,
          messageId: "mutableStateObject",
          data: {
            name,
            kind,
            props: mutableProps
              .map((m: any) =>
                m.key.type === "Identifier" ? m.key.name : "?",
              )
              .join(", "),
          },
        });
      }
    }

    return {
      TSInterfaceBody(node) {
        checkNode(
          node.body,
          node.parent as any,
          "interface",
          "TSInterfaceDeclaration",
        );
      },

      TSTypeLiteral(node) {
        checkNode(
          node.members,
          node.parent as any,
          "type",
          "TSTypeAliasDeclaration",
        );
      },
    };
  },
});
