import { AST_NODE_TYPES, TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { getChildren } from "../utils/ast-helpers.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T33-self-type.md");

function collectReturns(node: TSESTree.Node): TSESTree.ReturnStatement[] {
  const results: TSESTree.ReturnStatement[] = [];
  if (node.type === AST_NODE_TYPES.ReturnStatement) {
    results.push(node);
  }
  for (const child of getChildren(node)) {
    results.push(...collectReturns(child));
  }
  return results;
}

/**
 * Checks whether all return statements in a method return `this` (or nothing).
 *
 * Intentionally shallow — does not verify reachability. A method with an
 * unreachable `return this` as its last statement (e.g. after a
 * `try { … } finally { throw … }`) will still match. Reachability analysis
 * is out of scope for this rule.
 */
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
        "Method returns the class's own type ({{className}}) but returns `this` at runtime. Use `this` as the return type to preserve chainability in subclasses. See: {{url}}",
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
              data: { className, url: URL },
            });
          }
        }
      },
    };
  },
});
