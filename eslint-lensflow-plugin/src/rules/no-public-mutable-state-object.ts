import { createRule } from "../utils/rule-creator.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

const statefulEntityPattern =
  /account|wallet|balance|counter|state|inventory|cart|session|store|registry|pool|cache|buffer|accumulator|collector/i;

function isArrayType(node: TSESTree.TypeNode): boolean {
  if (node.type === "TSArrayType") return true;
  if (
    node.type === "TSTypeReference" &&
    node.typeName.type === "Identifier" &&
    node.typeName.name === "Array"
  )
    return true;
  return false;
}

function hasMutableStateType(typeAnnotation: TSESTree.TypeNode): boolean {
  if (!typeAnnotation) return false;

  const { type } = typeAnnotation;

  if (type === "TSNumberKeyword" || type === "TSStringKeyword") return true;

  if (isArrayType(typeAnnotation)) return true;

  if (type === "TSUnionType") {
    return typeAnnotation.types.some(
      (t: TSESTree.TypeNode) =>
        t.type === "TSNumberKeyword" ||
        t.type === "TSStringKeyword" ||
        isArrayType(t),
    );
  }

  return false;
}

function findEnclosingDeclaration(
  node: TSESTree.Node,
): TSESTree.TSTypeAliasDeclaration | TSESTree.TSInterfaceDeclaration | null {
  let current: TSESTree.Node | undefined = (node as TSESTree.Node & { parent?: TSESTree.Node }).parent;
  while (current) {
    if (
      current.type === "TSTypeAliasDeclaration"
    ) {
      return current as TSESTree.TSTypeAliasDeclaration;
    }
    if (
      current.type === "TSInterfaceDeclaration"
    ) {
      return current as TSESTree.TSInterfaceDeclaration;
    }
    current = (current as TSESTree.Node & { parent?: TSESTree.Node }).parent;
  }
  return null;
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
      members: TSESTree.TypeElement[],
      parent: TSESTree.TSInterfaceDeclaration | TSESTree.TSTypeAliasDeclaration,
      kind: "interface" | "type",
      parentType: string,
    ) {
      if (parent?.type !== parentType || !parent.id) return;

      const name = parent.id.name;
      if (!statefulEntityPattern.test(name)) return;

      const mutableProps = members.filter(
        (member): member is TSESTree.TSPropertySignature =>
          member.type === "TSPropertySignature" &&
          !member.readonly &&
          !!member.typeAnnotation &&
          hasMutableStateType(member.typeAnnotation.typeAnnotation),
      );

      if (mutableProps.length > 0) {
        context.report({
          node: parent,
          messageId: "mutableStateObject",
          data: {
            name,
            kind,
            props: mutableProps
              .map((m) =>
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
          node.parent as TSESTree.TSInterfaceDeclaration,
          "interface",
          "TSInterfaceDeclaration",
        );
      },

      TSTypeLiteral(node) {
        const enclosing = findEnclosingDeclaration(node);
        if (!enclosing) return;

        checkNode(
          node.members,
          enclosing,
          enclosing.type === "TSInterfaceDeclaration"
            ? "interface"
            : "type",
          enclosing.type,
        );
      },
    };
  },
});
