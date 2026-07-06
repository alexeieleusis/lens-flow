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

function extractIdentifiersFromParam(
  node: TSESTree.DestructuringPattern,
  ids: Set<TSESTree.Identifier>,
): void {
  switch (node.type) {
    case "Identifier":
      ids.add(node);
      break;
    case "ObjectPattern":
      for (const prop of node.properties) {
        if (prop.type === "Property") {
          extractIdentifiersFromParam(prop.value as TSESTree.DestructuringPattern, ids);
        } else if (prop.type === "RestElement") {
          extractIdentifiersFromParam(prop.argument, ids);
        }
      }
      break;
    case "ArrayPattern":
      for (const element of node.elements) {
        if (element) {
          extractIdentifiersFromParam(element, ids);
        }
      }
      break;
    case "RestElement":
      extractIdentifiersFromParam(node.argument, ids);
      break;
  }
}

function getParamBaseNode(param: TSESTree.Parameter): TSESTree.DestructuringPattern {
  if (param.type === "AssignmentPattern") {
    return param.left;
  }
  if (param.type === "RestElement") {
    return param.argument;
  }
  if (param.type === "TSParameterProperty") {
    return (param as TSESTree.TSParameterProperty).parameter as TSESTree.DestructuringPattern;
  }
  return param as TSESTree.DestructuringPattern;
}

function getUnionParamIdentifiers(fnNode: FunctionNode): Set<TSESTree.Identifier> {
  const params = fnNode.params;
  const ids = new Set<TSESTree.Identifier>();
  for (const param of params) {
    const baseNode = getParamBaseNode(param);
    const typeAnn = (baseNode as TSESTree.Identifier | TSESTree.ObjectPattern | TSESTree.ArrayPattern).typeAnnotation;
    if (!isUnionType(typeAnn)) continue;
    extractIdentifiersFromParam(baseNode, ids);
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

const TS_WRAPPER_TYPES = new Set([
  "TSAsExpression",
  "TSTypeAssertion",
  "TSNonNullExpression",
  "TSSatisfiesExpression",
]);

function unwrapTSWrapper(node: TSESTree.Node): TSESTree.Node {
  let current: TSESTree.Node = node;
  while (TS_WRAPPER_TYPES.has(current.type)) {
    if (
      current.type === "TSAsExpression" ||
      current.type === "TSTypeAssertion" ||
      current.type === "TSNonNullExpression"
    ) {
      current = (current as TSESTree.TSAsExpression | TSESTree.TSTypeAssertion | TSESTree.TSNonNullExpression).expression;
    } else if (current.type === "TSSatisfiesExpression") {
      current = (current as TSESTree.TSSatisfiesExpression).expression;
    } else {
      break;
    }
  }
  return current;
}

function isDerivedFromParam(
  sourceCode: TSESLint.SourceCode,
  expr: TSESTree.Node,
  fnNode: FunctionNode,
): boolean {
  const unwrapped = unwrapTSWrapper(expr);

  let rootIdent: TSESTree.Identifier | undefined;

  if (unwrapped.type === "Identifier") {
    rootIdent = unwrapped;
  } else if (unwrapped.type === "MemberExpression") {
    let root: TSESTree.Node = unwrapped;
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
        "Disallow `as any` type assertions inside functions that handle union-typed parameter values, which bypass type narrowing and lose all type safety.",
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
