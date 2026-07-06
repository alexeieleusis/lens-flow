import { createRule } from "../utils/rule-creator.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

type FunctionNode =
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression
  | TSESTree.ArrowFunctionExpression;

function isFunctionNode(node: TSESTree.Node): node is FunctionNode {
  return (
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression" ||
    node.type === "ArrowFunctionExpression"
  );
}

function unwrapTSTypeAnnotation(
  node: TSESTree.TSTypeAnnotation | TSESTree.TypeNode | undefined,
): TSESTree.TypeNode | undefined {
  if (node?.type === "TSTypeAnnotation") {
    return node.typeAnnotation;
  }
  return node as TSESTree.TypeNode | undefined;
}

function isUnionType(
  typeAnnotation: TSESTree.TSTypeAnnotation | undefined,
): boolean {
  const unwrapped = unwrapTSTypeAnnotation(typeAnnotation);
  return unwrapped?.type === "TSUnionType";
}

function findNearestEnclosingFunction(
  ancestors: TSESTree.Node[],
): FunctionNode | undefined {
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const node = ancestors[i];
    if (isFunctionNode(node)) {
      return node;
    }
  }
  return;
}

function getUnionParamNames(fnNode: FunctionNode): Set<string> {
  const params = fnNode.params;
  const names = new Set<string>();
  for (const param of params) {
    // For AssignmentPattern, type annotation is on the left Identifier, not the pattern itself
    let typeAnn: TSESTree.TSTypeAnnotation | undefined;
    if (param.type === "AssignmentPattern" && param.left.type === "Identifier") {
      typeAnn = param.left.typeAnnotation;
    } else if (param.type === "Identifier") {
      typeAnn = param.typeAnnotation;
    }
    if (!isUnionType(typeAnn)) continue;

    if (param.type === "Identifier") {
      names.add(param.name);
    } else if (
      param.type === "AssignmentPattern" &&
      param.left.type === "Identifier"
    ) {
      names.add(param.left.name);
    }
  }
  return names;
}

function isDerivedFromParam(expr: TSESTree.Node, paramNames: Set<string>): boolean {
  if (expr.type === "Identifier") {
    return paramNames.has(expr.name);
  }

  if (expr.type === "MemberExpression") {
    const rootObj = expr.object;
    if (rootObj.type === "Identifier") {
      return paramNames.has(rootObj.name);
    }
  }

  return false;
}

export default createRule({
  name: "no-as-any-union-handling-uc14",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `as any` type assertions inside functions that handle discriminated union values, which bypass type narrowing and lose all type safety.",
    },
    messages: {
      asAnyBypassNarrowing:
        "Avoid casting `{{expr}}` to `any` inside a function with a union-typed parameter. Use proper type narrowing (e.g., `if (s.kind === \"circle\")`) instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC14-extensibility.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"asAnyBypassNarrowing", []>) {
    return {
      TSAsExpression(node) {
        if (node.typeAnnotation.type !== "TSAnyKeyword") return;

        const ancestors = context.sourceCode.getAncestors(node);
        const fnNode = findNearestEnclosingFunction(ancestors);
        if (!fnNode) return;

        const unionParamNames = getUnionParamNames(fnNode);
        if (unionParamNames.size === 0) return;
        const expression = node.expression;

        if (!isDerivedFromParam(expression, unionParamNames)) return;

        const exprName =
          expression.type === "Identifier"
            ? expression.name
            : "expression";

        context.report({
          node,
          messageId: "asAnyBypassNarrowing",
          data: { expr: String(exprName) },
        });
      },
    };
  },
});
