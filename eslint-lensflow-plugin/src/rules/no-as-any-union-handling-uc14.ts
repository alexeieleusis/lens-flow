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

function getUnionParamIdentifiers(fnNode: FunctionNode): Set<TSESTree.Identifier> {
  const params = fnNode.params;
  const ids = new Set<TSESTree.Identifier>();
  for (const param of params) {
    let typeAnn: TSESTree.TSTypeAnnotation | undefined;
    let ident: TSESTree.Identifier | undefined;
    if (param.type === "AssignmentPattern" && param.left.type === "Identifier") {
      typeAnn = param.left.typeAnnotation;
      ident = param.left;
    } else if (param.type === "Identifier") {
      typeAnn = param.typeAnnotation;
      ident = param;
    }
    if (!isUnionType(typeAnn) || !ident) continue;
    ids.add(ident);
  }
  return ids;
}

function findAncestorFunctionWithUnionParam(
  sourceCode: TSESLint.SourceCode,
  ancestors: TSESTree.Node[],
  expression: TSESTree.Node,
): { fn: FunctionNode; unionParamIds: Set<TSESTree.Identifier> } | undefined {
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const node = ancestors[i];
    if (!isFunctionNode(node)) continue;

    if (isDerivedFromParam(sourceCode, expression, node)) {
      const unionParamIds = getUnionParamIdentifiers(node);
      if (unionParamIds.size > 0) {
        return { fn: node, unionParamIds };
      }
      return undefined;
    }
  }
  return undefined;
}

function isDerivedFromParam(
  sourceCode: TSESLint.SourceCode,
  expr: TSESTree.Node,
  fnNode: FunctionNode,
): boolean {
  let rootIdent: TSESTree.Identifier | undefined;

  if (expr.type === "Identifier") {
    rootIdent = expr;
  } else if (expr.type === "MemberExpression") {
    let root: TSESTree.Node = expr;
    while (root.type === "MemberExpression") {
      root = root.object;
    }
    if (root.type === "Identifier") {
      rootIdent = root;
    }
  }

  if (!rootIdent) return false;

  let currentScope: TSESLint.Scope.Scope | null = sourceCode.getScope(rootIdent);
  while (currentScope) {
    const variable = currentScope.set.get(rootIdent.name);
    if (variable) {
      return variable.defs.some(
        d => d.type === "Parameter" && d.parent === fnNode,
      );
    }
    currentScope = currentScope.upper;
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
    const sourceCode = context.sourceCode;

    return {
      TSAsExpression(node) {
        if (node.typeAnnotation.type !== "TSAnyKeyword") return;

        const expression = node.expression;
        const ancestors = sourceCode.getAncestors(node);
        const result = findAncestorFunctionWithUnionParam(sourceCode, ancestors, expression);
        if (!result) return;

        if (!isDerivedFromParam(sourceCode, expression, result.fn)) return;

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
