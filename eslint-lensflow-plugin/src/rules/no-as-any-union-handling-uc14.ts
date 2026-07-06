import { createRule } from "../utils/rule-creator.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

type FunctionNode =
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression
  | TSESTree.ArrowFunctionExpression;

type ExtractablePattern =
  | TSESTree.Identifier
  | TSESTree.ObjectPattern
  | TSESTree.ArrayPattern
  | TSESTree.TSParameterProperty
  | TSESTree.AssignmentPattern;

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
  if (!node) return undefined;

  let current: TSESTree.TypeNode | undefined =
    node.type === "TSTypeAnnotation" ? node.typeAnnotation : node;

  while (current?.type === "TSOptionalType") {
    current = current.typeAnnotation;
  }

  return current;
}

function isUnionType(
  typeAnnotation: TSESTree.TSTypeAnnotation | undefined,
): boolean {
  const unwrapped = unwrapTSTypeAnnotation(typeAnnotation);
  return unwrapped?.type === "TSUnionType";
}

function extractIdentifiersFromParam(
  node: ExtractablePattern | TSESTree.RestElement,
  ids: Set<TSESTree.Identifier>,
): void {
  switch (node.type) {
    case "Identifier":
      ids.add(node);
      break;
    case "ObjectPattern":
      for (const prop of node.properties) {
        if (prop.type === "Property") {
          extractIdentifiersFromParam(prop.value, ids);
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
    case "TSParameterProperty":
      extractIdentifiersFromParam(node.parameter, ids);
      break;
    case "AssignmentPattern":
      extractIdentifiersFromParam(node.left, ids);
      break;
  }
}

function getParamBaseNode(param: TSESTree.Parameter): ExtractablePattern {
  if (param.type === "AssignmentPattern") {
    return param.left;
  }
  if (param.type === "RestElement") {
    return param.argument;
  }
  if (param.type === "TSParameterProperty") {
    return param.parameter;
  }
  return param;
}

function getUnionParamIdentifiers(fnNode: FunctionNode): Set<TSESTree.Identifier> {
  const params = fnNode.params;
  const ids = new Set<TSESTree.Identifier>();
  for (const param of params) {
    const baseNode = getParamBaseNode(param);
    const typeAnn = (baseNode as TSESTree.Identifier | TSESTree.ObjectPattern | TSESTree.ArrayPattern | TSESTree.TSParameterProperty | TSESTree.AssignmentPattern).typeAnnotation;
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

    const unionParamIds = getUnionParamIdentifiers(node);
    if (unionParamIds.size > 0 && isDerivedFromParam(sourceCode, expression, node)) {
      return { fn: node, unionParamIds };
    }
    return undefined;
  }
  return undefined;
}

function isTSAsExpression(node: TSESTree.Node): node is TSESTree.TSAsExpression {
  return node.type === "TSAsExpression";
}

function isTSTypeAssertion(node: TSESTree.Node): node is TSESTree.TSTypeAssertion {
  return node.type === "TSTypeAssertion";
}

function isTSNonNullExpression(node: TSESTree.Node): node is TSESTree.TSNonNullExpression {
  return node.type === "TSNonNullExpression";
}

function isTSSatisfiesExpression(node: TSESTree.Node): node is TSESTree.TSSatisfiesExpression {
  return node.type === "TSSatisfiesExpression";
}

function unwrapTSWrapper(node: TSESTree.Node): TSESTree.Node {
  let current: TSESTree.Node = node;

  while (true) {
    if (isTSAsExpression(current) || isTSTypeAssertion(current) || isTSNonNullExpression(current)) {
      current = current.expression;
    } else if (isTSSatisfiesExpression(current)) {
      current = current.expression;
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
