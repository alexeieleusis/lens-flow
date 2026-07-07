import { AST_NODE_TYPES, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

export default createRule({
  name: "no-mutable-getter-return",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallows class getters that return mutable collection types, preventing callers from bypassing encapsulation",
    },
    messages: {
      mutableArray:
        "Getter returns mutable array type {{returnType}}. Use readonly array to preserve encapsulation. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T21-encapsulation.md",
      mutableCollection:
        "Getter returns mutable collection type {{returnType}}. Use {{suggestion}} to preserve encapsulation. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T21-encapsulation.md",
      mutableObject:
        "Getter returns mutable object type. Return a copy or use a readonly type to preserve encapsulation. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T21-encapsulation.md",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"mutableArray" | "mutableCollection" | "mutableObject", []>) {
    const checkGetterReturn = (member: any) => {
      const returnType = member.value.returnType?.typeAnnotation;
      if (!returnType) return;

      const rt = returnType as unknown as Record<string, unknown>;
      checkArrayType(rt, member);
      checkReferenceType(rt, member);
      checkLiteralType(rt, member);
    };

    const checkArrayType = (rt: Record<string, unknown>, member: any) => {
      if (rt.type !== AST_NODE_TYPES.TSArrayType) return;

      const elemType = (rt as any).elementType;
      if (
        elemType?.type !== AST_NODE_TYPES.TSTypeOperator ||
        elemType?.operator !== "readonly"
      ) {
        const sourceCode = context.sourceCode;
        const returnText = sourceCode.getText(
          member.value.returnType || member.value,
        );
        context.report({
          node: member,
          messageId: "mutableArray",
          data: { returnType: returnText },
        });
      }
    };

    const checkReferenceType = (rt: Record<string, unknown>, member: any) => {
      if (rt.type !== AST_NODE_TYPES.TSTypeReference) return;

      const typeName = (rt as any).typeName;
      if (!typeName || typeof typeName.name !== "string") return;

      const name = typeName.name;
      if (name !== "Map" && name !== "Set") return;

      const suggestion = name === "Map" ? "ReadonlyMap" : "ReadonlySet";
      context.report({
        node: member,
        messageId: "mutableCollection",
        data: { returnType: name, suggestion },
      });
    };

    const checkLiteralType = (rt: Record<string, unknown>, member: any) => {
      if (rt.type !== AST_NODE_TYPES.TSTypeLiteral) return;

      context.report({
        node: member,
        messageId: "mutableObject",
      });
    };

    return {
      ClassBody(node) {
        for (const member of node.body) {
          if (
            member.type !== AST_NODE_TYPES.MethodDefinition ||
            member.kind !== "get"
          ) {
            continue;
          }

          checkGetterReturn(member);
        }
      },
    };
  },
});
