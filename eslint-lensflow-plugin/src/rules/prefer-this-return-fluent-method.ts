import { AST_NODE_TYPES, TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

function collectReturns(node: TSESTree.Node): TSESTree.ReturnStatement[] {
  const results: TSESTree.ReturnStatement[] = [];
  if (node.type === AST_NODE_TYPES.ReturnStatement) {
    results.push(node);
  }
  for (const child of Object.values(node)) {
    if (Array.isArray(child)) {
      for (const item of child) {
        if (item && typeof item === "object" && "type" in item) {
          results.push(...collectReturns(item as TSESTree.Node));
        }
      }
    } else if (child && typeof child === "object" && "type" in child) {
      results.push(...collectReturns(child as TSESTree.Node));
    }
  }
  return results;
}

function returnsThis(node: TSESTree.MethodDefinition): boolean {
  if (node.value?.type !== AST_NODE_TYPES.FunctionExpression) return false;
  const fn = node.value;

  const returns = collectReturns(fn.body);
  if (returns.length === 0) return false;

  return returns.every(
    (ret) =>
      ret.argument === null || ret.argument.type === AST_NODE_TYPES.ThisExpression
  );
}

export default createRule({
  name: "prefer-this-return-fluent-method",
  meta: {
    type: "problem",
    docs: {
      description:
        "Enforce using `this` as return type in fluent builder methods that return `this`",
    },
    messages: {
      preferThis:
        "Method returns the class's own type ({{className}}) but returns `this` at runtime. Use `this` as the return type to preserve chainability in subclasses. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T33-self-type.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"preferThis", []>) {
    return {
      MethodDefinition(node) {
        const ancestors = context.sourceCode.getAncestors(node);
        const classNode = ancestors.find(
          (a) =>
            a.type === AST_NODE_TYPES.ClassDeclaration ||
            a.type === AST_NODE_TYPES.ClassExpression,
        );
        if (!classNode?.id) return;

        const className = classNode.id.name;

        const fnValue =
          node.value?.type === AST_NODE_TYPES.FunctionExpression
            ? node.value
            : null;
        const returnType = fnValue?.returnType?.typeAnnotation;

        if (
          returnType?.type === AST_NODE_TYPES.TSTypeReference &&
          returnType.typeName.type === AST_NODE_TYPES.Identifier &&
          returnType.typeName.name === className
        ) {
          if (returnsThis(node)) {
            context.report({
              node: returnType,
              messageId: "preferThis",
              data: { className },
            });
          }
        }
      },
    };
  },
});
