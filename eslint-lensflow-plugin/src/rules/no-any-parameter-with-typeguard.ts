import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

function collectAnyParams(params: any[]): Array<{ name: string; anyNode: any }> {
  const anyParams: Array<{ name: string; anyNode: any }> = [];

  for (const param of params) {
    let base: any;
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

function isNode(value: any): boolean {
  return value != null && typeof value === "object" && "type" in value;
}

function isTypeguardNode(
  node: any,
): { paramName: string; kind: string } | null {
  if (node.type === "UnaryExpression" && node.operator === "typeof") {
    if (node.argument.type === "Identifier") {
      return { paramName: node.argument.name, kind: "typeof" };
    }
    return null;
  }
  if (
    node.type === "BinaryExpression" &&
    node.operator === "instanceof"
  ) {
    if (node.left.type === "Identifier") {
      return { paramName: node.left.name, kind: "instanceof" };
    }
    return null;
  }
  return null;
}

function extractChildren(node: any): any[] {
  const children: any[] = [];
  for (const key of Object.keys(node)) {
    if (key === "parent" || key === "scope") continue;
    const child = node[key];
    if (Array.isArray(child)) {
      children.push(...child.filter((item) => isNode(item)));
    } else if (isNode(child)) {
      children.push(child);
    }
  }
  return children;
}

function collectTypeguardTargets(
  body: any,
): Array<{ paramName: string; kind: string }> {
  const results: Array<{ paramName: string; kind: string }> = [];
  const stack: any[] = [body];

  while (stack.length > 0) {
    const n = stack.pop();
    if (!isNode(n)) continue;

    const tg = isTypeguardNode(n);
    if (tg) results.push(tg);

    // Do not traverse into nested functions — their typeguards target
    // their own parameters, not the outer function's parameters.
    if (
      n.type === "FunctionDeclaration" ||
      n.type === "FunctionExpression" ||
      n.type === "ArrowFunctionExpression"
    ) {
      continue;
    }

    stack.push(...extractChildren(n));
  }

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
      anyParams: Array<{ name: string; anyNode: any }>,
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

    function visitFunction(node: {
      params: any[];
      body?: any;
      expression?: boolean;
    }) {
      const anyParams = collectAnyParams(node.params);

      if (anyParams.length === 0 || !node.body) return;

      const typeguards = collectTypeguardTargets(node.body);

      reportAnyParamTypeguards(anyParams, typeguards);
    }

    return {
      FunctionDeclaration: visitFunction,
      FunctionExpression: visitFunction,
      ArrowFunctionExpression: visitFunction,
    };
  },
});
