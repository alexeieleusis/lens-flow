import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

const URL = knowledgeUrl("catalog/T47-gradual-typing.md");

function findAnyParams(
  params: readonly TSESTree.Parameter[],
): Array<{ name: string; anyNode: TSESTree.TSAnyKeyword; paramNode: TSESTree.Node }> {
  const results: Array<{ name: string; anyNode: TSESTree.TSAnyKeyword; paramNode: TSESTree.Node }> = [];

  for (const param of params) {
    let base: TSESTree.Node;
    if (param.type === "TSParameterProperty") {
      base = param.parameter;
    } else if (param.type === "AssignmentPattern") {
      base = param.left;
    } else {
      base = param;
    }

    const typeAnn = (base as TSESTree.Identifier | TSESTree.ObjectPattern | TSESTree.ArrayPattern)
      .typeAnnotation?.typeAnnotation;

    if (typeAnn?.type === "TSAnyKeyword") {
      const name = (base as TSESTree.Identifier).name ?? "unnamed";
      results.push({ name, anyNode: typeAnn, paramNode: base });
    }
  }

  return results;
}

function bodyOnlyNarrows(
  body: TSESTree.BlockStatement,
  paramIdentifier: TSESTree.Identifier,
  funcScope: TSESLint.Scope.Scope,
): boolean {
  let hasNarrowing = false;
  let hasUnsafeDirectAccess = false;

  const skipKeys = new Set(["parent", "scope"]);
  const narrowingScope: boolean[] = [];

  const isParamBinding = (identifier: TSESTree.Identifier): boolean => {
    if (identifier.name !== paramIdentifier.name) return false;
    const binding = funcScope.variables.find((v) => v.name === identifier.name);
    if (!binding) return false;
    return binding.identifiers[0] === paramIdentifier;
  };

  function checkInstanceof(n: TSESTree.BinaryExpression): boolean {
    if (n.type !== "BinaryExpression" || n.operator !== "instanceof") return false;
    return n.left.type === "Identifier" && isParamBinding(n.left);
  }

  function checkBinaryExpression(n: TSESTree.BinaryExpression): boolean {
    if (n.type !== "BinaryExpression") return false;

    if (
      n.left.type === "UnaryExpression" &&
      n.left.operator === "typeof"
    ) {
      if (n.left.argument.type === "Identifier" && isParamBinding(n.left.argument)) return true;
    }

    if (n.left.type === "Identifier" && isParamBinding(n.left)) {
      if (
        n.right.type === "Literal" &&
        typeof n.right.value === "string"
      ) {
        return true;
      }
    }

    return false;
  }

  function checkUnaryTypeof(n: TSESTree.UnaryExpression): boolean {
    if (n.type !== "UnaryExpression" || n.operator !== "typeof") return false;
    return n.argument.type === "Identifier" && isParamBinding(n.argument);
  }

  function detectNarrowingParam(testNode: TSESTree.Node): boolean {
    let narrowed = false;
    if (
      (testNode.type === "BinaryExpression" && (checkInstanceof(testNode) || checkBinaryExpression(testNode))) ||
      (testNode.type === "UnaryExpression" && checkUnaryTypeof(testNode))
    ) {
      narrowed = true;
    }

    if (narrowed) {
      hasNarrowing = true;
      return true;
    }

    return false;
  }

  function visitIfStatement(n: TSESTree.IfStatement, parent: TSESTree.Node | null): void {
    const narrowed = detectNarrowingParam(n.test);

    visit(n.test, parent);

    if (narrowed) {
      narrowingScope.push(true);
      visit(n.consequent, parent);
      narrowingScope.pop();
    } else {
      visit(n.consequent, parent);
    }

    if (n.alternate) {
      visit(n.alternate, parent);
    }
  }

  function checkIdentifierUsage(currentNode: TSESTree.Identifier, parent: TSESTree.Node): void {
    if (
      parent.type === "UnaryExpression" &&
      parent.operator === "typeof" &&
      parent.argument === currentNode
    ) {
      hasNarrowing = true;
      return;
    }

    if (
      parent.type === "BinaryExpression" &&
      parent.operator === "instanceof" &&
      parent.left === currentNode
    ) {
      hasNarrowing = true;
      return;
    }

    if (parent.type === "MemberExpression" && parent.object === currentNode) {
      const isNarrowed = narrowingScope.includes(true);
      if (!isNarrowed) {
        hasUnsafeDirectAccess = true;
      }
    }
  }

  function recurseChildren(n: TSESTree.Node, currentNode: TSESTree.Node): void {
    const record = n as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(record)) {
      if (skipKeys.has(key)) continue;

      if (Array.isArray(value)) {
        for (const child of value) {
          if (child && typeof child === "object" && "type" in child) {
            visit(child as TSESTree.Node, currentNode);
          }
        }
      } else if (value && typeof value === "object" && "type" in value) {
        visit(value as TSESTree.Node, currentNode);
      }
    }
  }

  const functionBoundaryTypes = new Set([
    "FunctionDeclaration",
    "FunctionExpression",
    "ArrowFunctionExpression",
  ]);

  function visit(node: TSESTree.Node, parent: TSESTree.Node | null): void {
    if (node.type === "IfStatement") {
      visitIfStatement(node, parent);
      return;
    }

    if (node.type === "Identifier" && isParamBinding(node) && parent) {
      checkIdentifierUsage(node, parent);
      return;
    }

    if (functionBoundaryTypes.has(node.type)) {
      return;
    }

    recurseChildren(node, node);
  }

  visit(body, null);

  return hasNarrowing && !hasUnsafeDirectAccess;
}

export default createRule({
  name: "prefer-unknown-over-any",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer `unknown` over `any` for function parameters that are only narrowed, never directly accessed",
    },
    messages: {
     preferUnknown:
         "Parameter `{{name}}` is typed as `any` but is only used in narrowing expressions. Use `unknown` instead, which forces type-safe narrowing. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"preferUnknown", []>) {
    const sourceCode = context.sourceCode;

    function visitFunction(node: TSESTree.FunctionLike) {
      if (!node.body) return;

      if (node.body.type !== "BlockStatement") return;
      const body = node.body;

      const scopeManager = sourceCode.scopeManager;
      if (!scopeManager) return;

      const anyParams = findAnyParams(node.params);

      let funcScope: TSESLint.Scope.Scope | null = scopeManager.acquire(node) ?? scopeManager.acquire(node.body);
      funcScope ??= scopeManager.scopes.find(
        (s) => s.type === "function" && s.variables.some((v) => v.name === anyParams[0]?.name),
      ) ?? null;
      if (!funcScope) {
        return;
      }

      for (const { name, anyNode, paramNode } of anyParams) {
        if (paramNode?.type === "Identifier" && bodyOnlyNarrows(body, paramNode, funcScope)) {
          context.report({
            node: anyNode,
            messageId: "preferUnknown",
            data: { name, url: URL },
          });
        }
      }
    }

    return {
      FunctionDeclaration: visitFunction,
      FunctionExpression: visitFunction,
      ArrowFunctionExpression: visitFunction,
      TSEmptyBodyFunctionExpression: visitFunction,
      TSFunctionType(_node: TSESTree.TSFunctionType) {
        // Type-only construct with no body to analyze narrowing — skip.
      },
      TSMethodSignature(_node: TSESTree.TSMethodSignature) {
        // Type-only construct with no body to analyze narrowing — skip.
      },
      MethodDefinition(node: TSESTree.MethodDefinition) {
        if (node.value) {
          visitFunction(node.value);
        }
      },
    };
  },
});
