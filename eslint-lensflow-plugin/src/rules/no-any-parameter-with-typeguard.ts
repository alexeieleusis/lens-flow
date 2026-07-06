import { createRule } from "../utils/rule-creator.js";
import { getChildren } from "../utils/ast-helpers.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

type ParamNode =
  | TSESTree.Identifier
  | TSESTree.AssignmentPattern
  | TSESTree.RestElement
  | TSESTree.ObjectPattern
  | TSESTree.ArrayPattern
  | TSESTree.TSParameterProperty;

function collectAnyParams(
  params: ParamNode[],
): Array<{ name: string; anyNode: TSESTree.TSAnyKeyword }> {
  const anyParams: Array<{ name: string; anyNode: TSESTree.TSAnyKeyword }> = [];

  for (const param of params) {
    let base: TSESTree.Identifier | TSESTree.ObjectPattern | TSESTree.ArrayPattern | TSESTree.AssignmentPattern;
    if (param.type === "RestElement") {
      // typeAnnotation is on the RestElement itself, name on argument
      const typeAnn = param.typeAnnotation?.typeAnnotation;
      if (typeAnn?.type === "TSAnyKeyword") {
        anyParams.push({
          name: param.argument.type === "Identifier" ? param.argument.name : "(unknown)",
          anyNode: typeAnn,
        });
      }
      continue;
    }
    if (param.type === "AssignmentPattern") {
      base = param.left;
    } else if (param.type === "TSParameterProperty") {
      base = param.parameter;
    } else {
      base = param;
    }
    const typeAnn = base.typeAnnotation?.typeAnnotation;
    if (typeAnn?.type === "TSAnyKeyword") {
      const paramName =
        base.type === "Identifier" ? base.name : "(unknown)";
      anyParams.push({ name: paramName, anyNode: typeAnn });
    }
  }

  return anyParams;
}

function isTypeguardNode(
  node: TSESTree.Node,
): { paramName: string; kind: string } | null {
  if (node.type === "UnaryExpression") {
    const unaryNode = node as TSESTree.UnaryExpression;
    if (unaryNode.operator === "typeof" && unaryNode.argument.type === "Identifier") {
      return { paramName: (unaryNode.argument as TSESTree.Identifier).name, kind: "typeof" };
    }
    return null;
  }
  if (node.type === "BinaryExpression") {
    const binNode = node as TSESTree.BinaryExpression;
    if (binNode.operator === "instanceof" && binNode.left.type === "Identifier") {
      return { paramName: (binNode.left as TSESTree.Identifier).name, kind: "instanceof" };
    }
    return null;
  }
  return null;
}

function collectTypeguardTargets(
  body: TSESTree.Node,
): Array<{ paramName: string; kind: string }> {
  const results: Array<{ paramName: string; kind: string }> = [];
  const visited = new WeakSet<TSESTree.Node>();

  function innerWalk(node: TSESTree.Node): void {
    if (visited.has(node)) return;
    visited.add(node);

    const tg = isTypeguardNode(node);
    if (tg) results.push(tg);

    const children = getChildren(node, { stopAtFunctionBoundaries: true });
    for (const child of children) {
      if (child.type === "FunctionDeclaration" ||
          child.type === "FunctionExpression" ||
          child.type === "ArrowFunctionExpression") {
        continue;
      }
      innerWalk(child);
    }
  }

  innerWalk(body);

  return results;
}

export default createRule({
  name: "no-any-parameter-with-typeguard",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `any`-typed function parameters that are narrowed with typeof or instanceof checks",
    },
    messages: {
      anyParamWithTypeguard:
        "Parameter `{{name}}` is typed as `any` but narrowed with {{checkKind}} inside the function body. Use an explicit union type instead of `any`. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T02-union-intersection.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"anyParamWithTypeguard", []>) {
    function reportAnyParamTypeguards(
      anyParams: Array<{ name: string; anyNode: TSESTree.TSAnyKeyword }>,
      typeguards: Array<{ paramName: string; kind: string }>,
    ) {
      const anyParamNames = new Set(anyParams.map((p) => p.name));
      const reported = new Set<string>();

      for (const tg of typeguards) {
        if (anyParamNames.has(tg.paramName) && !reported.has(tg.paramName)) {
          reported.add(tg.paramName);
          const paramInfo = anyParams.find(
            (p) => p.name === tg.paramName,
          );
          if (paramInfo) {
            context.report({
              node: paramInfo.anyNode,
              messageId: "anyParamWithTypeguard",
              data: {
                name: tg.paramName,
                checkKind: tg.kind,
              },
            });
          }
        }
      }
    }

    type FunctionLike =
      | TSESTree.FunctionDeclaration
      | TSESTree.FunctionExpression
      | TSESTree.ArrowFunctionExpression;

    function visitFunction(node: FunctionLike) {
      const anyParams = collectAnyParams(node.params as ParamNode[]);

      if (anyParams.length === 0) return;

      const body = node.body;
      if (!body) return;

      const typeguards = collectTypeguardTargets(body as TSESTree.Node);

      reportAnyParamTypeguards(anyParams, typeguards);
    }

    return {
      FunctionDeclaration: visitFunction,
      FunctionExpression: visitFunction,
      ArrowFunctionExpression: visitFunction,
    };
  },
});
