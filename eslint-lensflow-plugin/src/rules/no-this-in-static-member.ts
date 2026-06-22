import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

function containsTSThisType(node: TSESTree.TypeNode): boolean {
  if (node.type === "TSThisType") return true;
  if (node.type === "TSUnionType" || node.type === "TSIntersectionType") {
    return node.types.some(containsTSThisType);
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
    return {
      MethodDefinition(node) {
        if (!node.static) return;
        const value = node.value;
        if (value.type !== "FunctionExpression") return;
        const retType = value.returnType?.typeAnnotation;
        if (retType && containsTSThisType(retType)) {
          context.report({
            node: value.returnType!,
            messageId: "staticThisReturn",
          });
        }
      },
    };
  },
});
