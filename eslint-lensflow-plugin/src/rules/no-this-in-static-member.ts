import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T33-self-type.md");

function containsTSThisType(node: TSESTree.TypeNode): boolean {
  if (node.type === "TSThisType") return true;
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
        "Using `this` as a return type in a static member. In static contexts, `this` refers to the constructor function, not an instance type. Use `InstanceType<typeof this>` or a generic `T extends typeof ThisClass` pattern instead. See: {{url}}",
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
          data: { url: URL },
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
    };
  },
});
