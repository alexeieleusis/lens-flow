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

function isUnionType(typeAnnotation: TSESTree.TypeNode | undefined): boolean {
  return typeAnnotation?.type === "TSUnionType";
}

type ExtractablePattern = TSESTree.Identifier | TSESTree.ObjectPattern | TSESTree.ArrayPattern;

function isExtractablePattern(node: TSESTree.Node): node is ExtractablePattern {
  return node.type === "Identifier" || node.type === "ObjectPattern" || node.type === "ArrayPattern";
}

function unwrapParam(param: TSESTree.Parameter): ExtractablePattern | undefined {
  if (param.type === "RestElement") {
    return isExtractablePattern(param.argument) ? param.argument : undefined;
  }
  if (param.type === "AssignmentPattern") {
    return isExtractablePattern(param.left) ? param.left : undefined;
  }
  if (param.type === "TSParameterProperty") return undefined;
  return param;
}

function getParamTypeAnnotation(param: TSESTree.Parameter): TSESTree.TypeNode | undefined {
  if (param.type === "AssignmentPattern") {
    return isExtractablePattern(param.left) ? param.left.typeAnnotation?.typeAnnotation : undefined;
  }
  if (param.type === "TSParameterProperty") return undefined;
  return param.typeAnnotation?.typeAnnotation;
}

function extractIdentifiers(node: ExtractablePattern): TSESTree.Identifier[] {
  if (node.type === "Identifier") return [node];
  if (node.type === "ArrayPattern") {
    const ids: TSESTree.Identifier[] = [];
    for (const element of node.elements) {
      if (element && isExtractablePattern(element)) {
        ids.push(...extractIdentifiers(element));
      }
    }
    return ids;
  }
  const ids: TSESTree.Identifier[] = [];
  for (const prop of node.properties) {
    if (prop.type === "Property" && isExtractablePattern(prop.value)) {
      ids.push(...extractIdentifiers(prop.value));
    } else if (prop.type === "RestElement" && prop.argument.type === "Identifier") {
      ids.push(prop.argument);
    }
  }
  return ids;
}

function getUnionParamIdentifiers(fnNode: FunctionNode): Set<TSESTree.Identifier> {
  const identifiers = new Set<TSESTree.Identifier>();
  for (const param of fnNode.params) {
    if (!isUnionType(getParamTypeAnnotation(param))) continue;
    const unwrapped = unwrapParam(param);
    if (!unwrapped) continue;
    for (const id of extractIdentifiers(unwrapped)) identifiers.add(id);
  }
  return identifiers;
}

function isDerivedFromParam(
  expr: TSESTree.Node,
  paramIdentifiers: Set<TSESTree.Identifier>,
  sourceCode: TSESLint.SourceCode,
): boolean {
  let targetId: TSESTree.Identifier | null = null;

  if (expr.type === "Identifier") {
    targetId = expr;
  } else if (expr.type === "MemberExpression") {
    let current: TSESTree.Node = expr.object;
    while (current.type === "MemberExpression") {
      current = current.object;
    }
    if (current.type === "Identifier") {
      targetId = current;
    }
  }

  if (!targetId) return false;

  const scope = sourceCode.getScope(targetId);
  const variable = scope.set.get(targetId.name);
  if (!variable) return false;

  return variable.defs.some(
    (def) => def.name.type === "Identifier" && paramIdentifiers.has(def.name),
  );
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

        const ancestors = sourceCode.getAncestors(node);
        let fnNode: FunctionNode | undefined;
        for (let i = ancestors.length - 1; i >= 0; i--) {
          const ancestor = ancestors[i];
          if (isFunctionNode(ancestor)) {
            fnNode = ancestor;
            break;
          }
        }
        if (!fnNode) return;

        const unionParamIdentifiers = getUnionParamIdentifiers(fnNode);
        if (unionParamIdentifiers.size === 0) return;

        const expression = node.expression;
        if (!isDerivedFromParam(expression, unionParamIdentifiers, sourceCode)) return;

        const exprName =
          expression.type === "Identifier" ? expression.name : "expression";

        context.report({
          node,
          messageId: "asAnyBypassNarrowing",
          data: { expr: String(exprName) },
        });
      },
    };
  },
});
