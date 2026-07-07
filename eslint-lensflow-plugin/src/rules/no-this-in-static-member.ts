import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

function containsTSThisType(node: TSESTree.TypeNode): boolean {
  if (node.type === "TSThisType") return true;
  if (node.type === "TSParenthesizedType") return containsTSThisType(node.typeAnnotation);
  if (node.type === "TSUnionType" || node.type === "TSIntersectionType") {
    return node.types.some(containsTSThisType);
  }
  // TSParenthesizedType exists at runtime but isn't in @typescript-eslint's types
  if (node.type === ("TSParenthesizedType" as TSESTree.TypeNode["type"])) {
    const casted = node as unknown as { typeAnnotation: TSESTree.TypeNode };
    return containsTSThisType(casted.typeAnnotation);
  }
  return false;
}

export default createRule({
  name: "no-this-in-static-member",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow using `this` as a return type in static members, where `this` refers to the constructor rather than an instance.",
    },
    messages: {
      staticThisReturn:
        "Using `this` as a return type in a static member. In static contexts, `this` refers to the constructor function, not an instance type. Use `InstanceType<typeof this>` or a generic `T extends typeof ThisClass` pattern instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T33-self-type.md",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"staticThisReturn", []>) {
    const reportIfStaticThisReturn = (
      funcNode:
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression
        | TSESTree.TSEmptyBodyFunctionExpression,
    ) => {
      const retType = funcNode.returnType?.typeAnnotation;
      if (retType && containsTSThisType(retType)) {
        context.report({
          node: funcNode.returnType!,
          messageId: "staticThisReturn",
        });
      }
    };

    const visitMethod = (
      node: TSESTree.MethodDefinition | TSESTree.TSAbstractMethodDefinition,
    ) => {
      if (!node.static) return;

      const value = node.value;
      if (!value) return;
      reportIfStaticThisReturn(value);
    };

    const visitProperty = (node: TSESTree.PropertyDefinition) => {
      if (!node.static) return;
      if (!node.value) return;

      const value = node.value;
      if (
        value.type === "ArrowFunctionExpression" ||
        value.type === "FunctionExpression"
      ) {
        reportIfStaticThisReturn(value);
      }
    };

    return {
      MethodDefinition(node) {
        visitMethod(node);
      },
      TSAbstractMethodDefinition(node) {
        visitMethod(node);
      },
      PropertyDefinition(node) {
        visitProperty(node);
      },
      TSAbstractMethodDefinition(node) {
        if (!node.static) return;
        const retType = node.returnType?.typeAnnotation;
        if (retType && containsTSThisType(retType)) {
          context.report({
            node: node.returnType!,
            messageId: "staticThisReturn",
          });
        }
      },
      PropertyDefinition(node) {
        if (!node.static) return;
        const value = node.value;
        if (
          value &&
          (value.type === "ArrowFunctionExpression" ||
            value.type === "FunctionExpression")
        ) {
          const retType = value.returnType?.typeAnnotation;
          if (retType && containsTSThisType(retType)) {
            context.report({
              node: value.returnType!,
              messageId: "staticThisReturn",
            });
          }
        }
      },
    };
  },
});
