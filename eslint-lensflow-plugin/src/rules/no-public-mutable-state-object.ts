import { createRule } from "../utils/rule-creator.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

const statefulEntityPattern =
  /account|wallet|balance|counter|state|inventory|cart|session|store|registry|pool|cache|buffer|accumulator|collector/i;

function isArrayType(node: TSESTree.TypeNode): boolean {
  if (node.type === "TSArrayType") return true;
  if (node.type === "TSTypeReference") {
    const { typeName } = node;
    if (typeName.type === "Identifier" && (typeName.name === "Array" || typeName.name === "ReadonlyArray"))
      return true;
    if (typeName.type === "TSQualifiedName" && typeName.right.name === "Array")
      return true;
    if (typeName.type === "TSQualifiedName" && typeName.right.name === "ReadonlyArray")
      return true;
  }
  return false;
}

function unwrapParenthesized(node: TSESTree.TypeNode): TSESTree.TypeNode {
  let current = node;
  // TSParenthesizedType exists at runtime but isn't in @typescript-eslint's types.
  while ((current as any).type === "TSParenthesizedType") {
    current = (current as any).typeAnnotation;
  }
  return current;
}

function hasMutableStateType(typeAnnotation: TSESTree.TypeNode): boolean {
  if (!typeAnnotation) return false;

  const unwrapped = unwrapParenthesized(typeAnnotation);
  const { type } = unwrapped;

  if (type === "TSNumberKeyword" || type === "TSStringKeyword") return true;

  if (isArrayType(unwrapped)) return true;

  if (type === "TSUnionType") {
    return unwrapped.types.some((t: TSESTree.TypeNode) => hasMutableStateType(t));
  }

  if (type === "TSIntersectionType") {
    return unwrapped.types.some((t: TSESTree.TypeNode) => hasMutableStateType(t));
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
      return current;
    }
    if (
      current.type === "TSInterfaceDeclaration"
    ) {
      return current;
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
    function getKeyLabel(key: TSESTree.Expression | TSESTree.PrivateIdentifier): string {
      if (key.type === "Identifier") return key.name;
      if (key.type === "Literal") return String(key.value);
      return "?";
    }

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
            props: mutableProps.map((m) => getKeyLabel(m.key)).join(", "),
          },
        });
      }
    }

    return {
      TSInterfaceBody(node) {
        checkNode(
          node.body,
          node.parent,
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
