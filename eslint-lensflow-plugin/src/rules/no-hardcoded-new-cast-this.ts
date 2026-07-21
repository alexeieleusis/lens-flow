import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESTree, TSESLint } from "@typescript-eslint/utils";

const URL = knowledgeUrl("catalog/T33-self-type.md");

type MethodNode =
  TSESTree.MethodDefinition | TSESTree.TSAbstractMethodDefinition;

function hasThisReturnType(node: TSESTree.MethodDefinition["value"]): boolean {
  const retType =
    "returnType" in node && node.returnType ? node.returnType : undefined;
  if (!retType) return false;
  const typeAnn = retType.typeAnnotation;
  if (typeAnn.type === "TSThisType") return true;
  if (typeAnn.type === "TSUnionType") {
    return typeAnn.types.some((t) => t.type === "TSThisType");
  }
  if (typeAnn.type === "TSIntersectionType") {
    return typeAnn.types.some((t) => t.type === "TSThisType");
  }
  return false;
}

function findEnclosingMethodWithThisReturn(
  ancestors: TSESTree.Node[],
): MethodNode | null {
  for (const ancestor of ancestors) {
    if (
      ancestor.type === "MethodDefinition" &&
      hasThisReturnType(ancestor.value)
    ) {
      return ancestor;
    }
    if (
      ancestor.type === "TSAbstractMethodDefinition" &&
      hasThisReturnType(
        ancestor as unknown as TSESTree.MethodDefinition["value"],
      )
    ) {
      return ancestor as MethodNode;
    }
  }
  return null;
}

export default createRule({
  name: "no-hardcoded-new-cast-this",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `new ConcreteClass() as this` which hardcodes the concrete class and breaks polymorphism for subclasses.",
    },
    messages: {
      hardcodedNewCastThis:
        "Do not use `new {{className}}() as this` — it hardcodes the concrete class and breaks polymorphism. Use `Object.create(Object.getPrototypeOf(this))` instead. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"hardcodedNewCastThis", []>) {
    return {
      ReturnStatement(node) {
        if (!node.argument) return;
        if (
          findEnclosingMethodWithThisReturn(
            context.sourceCode.getAncestors(node),
          )
        ) {
          if (
            node.argument.type === "TSAsExpression" &&
            node.argument.typeAnnotation.type === "TSThisType" &&
            node.argument.expression.type === "NewExpression" &&
            node.argument.expression.callee.type === "Identifier"
          ) {
            const className = node.argument.expression.callee.name;
            context.report({
              node: node.argument,
              messageId: "hardcodedNewCastThis",
              data: { className, url: URL },
            });
          }
        }
      },
    };
  },
});
