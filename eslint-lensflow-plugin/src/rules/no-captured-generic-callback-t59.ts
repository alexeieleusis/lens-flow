import { AST_NODE_TYPES, TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { walkNodes } from "../utils/ast-helpers.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T59-existential-types.md");

type FunctionNode =
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression
  | TSESTree.ArrowFunctionExpression;

function findEnclosingFunction(
  sourceCode: TSESLint.SourceCode,
  node: TSESTree.Node,
): FunctionNode | undefined {
  const ancestors = sourceCode.getAncestors(node);
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const current = ancestors[i];
    if (
      current.type === AST_NODE_TYPES.FunctionDeclaration ||
      current.type === AST_NODE_TYPES.FunctionExpression ||
      current.type === AST_NODE_TYPES.ArrowFunctionExpression
    ) {
      return current as FunctionNode;
    }
  }
  return undefined;
}

function isGenericCallbackType(typeAnn: TSESTree.TypeNode): boolean {
  return (
    typeAnn.type === AST_NODE_TYPES.TSFunctionType &&
    (typeAnn.typeParameters?.params.length ?? 0) > 0
  );
}

function extractParamIdentifier(
  param: TSESTree.Parameter,
):
  | (TSESTree.Identifier & { typeAnnotation?: TSESTree.TSTypeAnnotation })
  | null {
  if (param.type === AST_NODE_TYPES.Identifier) return param;
  if (param.type === AST_NODE_TYPES.TSParameterProperty)
    return param.parameter.type === AST_NODE_TYPES.Identifier
      ? param.parameter
      : null;
  if (param.type === AST_NODE_TYPES.RestElement)
    return param.argument.type === AST_NODE_TYPES.Identifier
      ? (param.argument as TSESTree.Identifier & {
          typeAnnotation?: TSESTree.TSTypeAnnotation;
        })
      : null;
  if (param.type === AST_NODE_TYPES.AssignmentPattern)
    return param.left.type === AST_NODE_TYPES.Identifier ? param.left : null;
  return null;
}

function isParameterOf(name: string, fn: FunctionNode): boolean {
  return fn.params.some((p) => {
    const ident = extractParamIdentifier(p);
    return ident !== null && ident.name === name;
  });
}

function getParamTypeAnnotation(
  name: string,
  fn: FunctionNode,
): TSESTree.TypeNode | undefined {
  const ident = fn.params
    .map((p) => extractParamIdentifier(p))
    .find(
      (
        i,
      ): i is TSESTree.Identifier & {
        typeAnnotation?: TSESTree.TSTypeAnnotation;
      } => i !== null && i.name === name,
    );
  return ident?.typeAnnotation?.typeAnnotation;
}

function hasVariableDeclaration(node: TSESTree.Node, name: string): boolean {
  if (
    node.type === AST_NODE_TYPES.FunctionDeclaration ||
    node.type === AST_NODE_TYPES.FunctionExpression ||
    node.type === AST_NODE_TYPES.ArrowFunctionExpression
  ) {
    return false;
  }
  return walkNodes(
    node,
    (n) =>
      n.type === AST_NODE_TYPES.VariableDeclaration &&
      (n as TSESTree.VariableDeclaration).declarations.some(
        (d) => d.id.type === AST_NODE_TYPES.Identifier && d.id.name === name,
      ),
  );
}

function isDeclaredInsideFn(name: string, fn: FunctionNode): boolean {
  if (isParameterOf(name, fn)) return true;

  const body = fn.body as TSESTree.BlockStatement | TSESTree.Node;
  if (!body) return false;

  // For block-bodied functions, scan all statements recursively.
  // For arrow functions with expression bodies, there are no local declarations.
  if (body.type === AST_NODE_TYPES.BlockStatement) {
    return body.body.some((stmt) => hasVariableDeclaration(stmt, name));
  }
  return false;
}

export default createRule({
  name: "no-captured-generic-callback-t59",
  meta: {
    type: "problem",
    fixable: undefined,
    docs: {
      description:
        "Disallow capturing a function parameter with a generic callback type into an outer-scope variable",
    },
    messages: {
      capturedGenericCallback:
        "Generic callback parameter '{{paramName}}' is captured into an outer-scope variable '{{targetName}}', leaking the existential type witness. Keep the callback within its declaring scope. See: {{url}}",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"capturedGenericCallback", []>) {
    function isGenericCallbackParam(
      rhs: TSESTree.Expression,
      sourceNode: TSESTree.Node,
    ): { paramName: string; fn: FunctionNode } | undefined {
      if (rhs.type !== AST_NODE_TYPES.Identifier || !("name" in rhs)) return;

      const paramName = rhs.name;
      const fn = findEnclosingFunction(context.sourceCode, sourceNode);
      if (!fn) return;

      if (!isParameterOf(paramName, fn)) return;

      const paramType = getParamTypeAnnotation(paramName, fn);
      if (!paramType || !isGenericCallbackType(paramType)) return;

      return { paramName, fn };
    }

    function checkCapture(
      targetName: string,
      rhs: TSESTree.Expression,
      sourceNode: TSESTree.Node,
    ) {
      const result = isGenericCallbackParam(rhs, sourceNode);
      if (!result) return;

      if (isDeclaredInsideFn(targetName, result.fn)) return;

      context.report({
        node: sourceNode,
        messageId: "capturedGenericCallback",
        data: { paramName: result.paramName, targetName, url: URL },
      });
    }

    function checkMemberCapture(
      memberNode: TSESTree.MemberExpression,
      rhs: TSESTree.Expression,
      sourceNode: TSESTree.Node,
    ) {
      const result = isGenericCallbackParam(rhs, sourceNode);
      if (!result) return;

      const targetName =
        memberNode.object.type === AST_NODE_TYPES.Identifier
          ? memberNode.object.name
          : "<member>";

      if (
        memberNode.object.type === AST_NODE_TYPES.Identifier &&
        isDeclaredInsideFn(memberNode.object.name, result.fn)
      ) {
        return;
      }

      context.report({
        node: sourceNode,
        messageId: "capturedGenericCallback",
        data: { paramName: result.paramName, targetName, url: URL },
      });
    }

    return {
      AssignmentExpression(node) {
        if (node.left.type === AST_NODE_TYPES.Identifier) {
          checkCapture(node.left.name, node.right, node);
        }
        if (node.left.type === AST_NODE_TYPES.MemberExpression) {
          checkMemberCapture(
            node.left as TSESTree.MemberExpression,
            node.right,
            node,
          );
        }
      },

      VariableDeclarator(node) {
        if (
          node.id.type === AST_NODE_TYPES.Identifier &&
          node.init?.type === AST_NODE_TYPES.Identifier
        ) {
          checkCapture(node.id.name, node.init, node);
        }
      },
    };
  },
});
