import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

interface FunctionInfo {
  node:
    | TSESTree.FunctionDeclaration
    | TSESTree.FunctionExpression
    | TSESTree.ArrowFunctionExpression;
  paramNames: string[];
  signatureKey: string;
  guards: Set<string>;
}

function extractGuards(
  body: TSESTree.BlockStatement,
  paramNames: string[],
): Set<string> {
  const guards = new Set<string>();
  const seen = new WeakSet<TSESTree.Node>();

  function isASTNode(val: unknown): val is TSESTree.Node {
    return (
      val !== null &&
      typeof val === "object" &&
      "type" in val &&
      typeof (val as unknown as Record<string, unknown>).type === "string"
    );
  }

  function extractBinaryGuard(
    node: TSESTree.BinaryExpression,
    params: string[],
  ) {
    if (!["<", ">", "<=", ">="].includes(node.operator)) return;

    let paramName: string | null = null;
    let literalValue: string | null = null;

    if (
      node.left.type === "Identifier" &&
      params.includes(node.left.name)
    ) {
      paramName = node.left.name;
      if (
        node.right.type === "Literal" &&
        typeof node.right.value === "number"
      ) {
        literalValue = String(node.right.value);
      }
    }

    if (
      node.right.type === "Identifier" &&
      params.includes(node.right.name)
    ) {
      paramName = node.right.name;
      if (
        node.left.type === "Literal" &&
        typeof node.left.value === "number"
      ) {
        literalValue = String(node.left.value);
      }
    }

    if (paramName && literalValue) {
      guards.add(`${paramName} ${node.operator} ${literalValue}`);
    }
  }

  function extractCallGuard(node: TSESTree.CallExpression, params: string[]) {
    let calleeName: string | null = null;
    if (node.callee.type === "Identifier") {
      calleeName = node.callee.name;
    } else if (
      node.callee.type === "MemberExpression" &&
      node.callee.property.type === "Identifier"
    ) {
      calleeName = node.callee.property.name;
    }

    if (!calleeName || !/^(isValid|validate|check)/i.test(calleeName)) return;

    const argParams = node.arguments
      .filter(
        (arg): arg is TSESTree.Identifier =>
          arg.type === "Identifier" && params.includes(arg.name),
      )
      .map((arg) => arg.name);

    if (argParams.length > 0) {
      guards.add(`${calleeName}(${argParams.join(",")})`);
    }
  }

  function walkChildren(node: TSESTree.Node) {
    for (const key of Object.keys(node)) {
      if (key === "parent") continue;
      const child = (node as unknown as Record<string, unknown>)[key];
      if (Array.isArray(child)) {
        for (const item of child) {
          if (isASTNode(item)) {
            walk(item);
          }
        }
      } else if (isASTNode(child)) {
        walk(child);
      }
    }
  }

  function walk(node: TSESTree.Node) {
    if (seen.has(node)) return;
    seen.add(node);

    if (node.type === "BinaryExpression") {
      extractBinaryGuard(node, paramNames);
    }

    if (node.type === "CallExpression") {
      extractCallGuard(node, paramNames);
    }

    walkChildren(node);
  }

  walk(body);
  return guards;
}

function extractParamName(
  param: TSESTree.Parameter,
): string | null {
  if (param.type === "Identifier") return param.name;
  return null;
}

export default createRule({
  name: "no-repeated-runtime-guards",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow duplicating the same runtime validation logic across multiple functions with matching parameter signatures",
    },
    messages: {
      repeatedGuard:
        "Duplicate runtime guard '{{guard}}' found in {{count}} functions with the same signature. Extract validation into a branded type or parse function. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/usecases/UC01-invalid-states.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"repeatedGuard", []>) {
    const sourceCode = context.sourceCode;
    const functions: FunctionInfo[] = [];

    function getSignatureKey(params: TSESTree.Parameter[]): string {
      return params
        .map((p) => {
          const effectiveParam = p.type === "TSParameterProperty" ? p.parameter : p;
          if (effectiveParam.typeAnnotation) {
            return sourceCode.getText(effectiveParam.typeAnnotation);
          }
          return ": unknown";
        })
        .join("|");
    }

    function visitFunction(
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression,
    ) {
      const params = node.params;
      const paramNames = params
        .map(extractParamName)
        .filter(Boolean) as string[];
      const signatureKey = getSignatureKey(params);

      if (paramNames.length === 0) return;

      const body =
        node.body?.type === "BlockStatement" ? node.body : null;
      if (!body) return;

      const guards = extractGuards(body, paramNames);

      functions.push({
        node,
        paramNames,
        signatureKey,
        guards,
      });
    }

    function groupFnsBySignature(fns: FunctionInfo[]): Map<string, FunctionInfo[]> {
      const groups = new Map<string, FunctionInfo[]>();
      for (const fn of fns) {
        const existing = groups.get(fn.signatureKey) || [];
        existing.push(fn);
        groups.set(fn.signatureKey, existing);
      }
      return groups;
    }

    function buildGuardMap(group: FunctionInfo[]): Map<string, FunctionInfo[]> {
      const guardMap = new Map<string, FunctionInfo[]>();
      for (const fn of group) {
        for (const guard of fn.guards) {
          const fns = guardMap.get(guard) || [];
          fns.push(fn);
          guardMap.set(guard, fns);
        }
      }
      return guardMap;
    }

    function reportRepeatedGuards(guardMap: Map<string, FunctionInfo[]>) {
      for (const [guard, fns] of guardMap) {
        if (fns.length >= 2) {
          for (const fn of fns) {
            context.report({
              node: fn.node,
              messageId: "repeatedGuard",
              data: {
                guard,
                count: String(fns.length),
              },
            });
          }
        }
      }
    }

    return {
      FunctionDeclaration(node) {
        visitFunction(node);
      },
      FunctionExpression(node) {
        visitFunction(node);
      },
      ArrowFunctionExpression(node) {
        visitFunction(node);
      },
      "Program:exit"() {
        const groups = groupFnsBySignature(functions);

        for (const [, group] of groups) {
          if (group.length < 2) continue;
          const guardMap = buildGuardMap(group);
          reportRepeatedGuards(guardMap);
        }
      },
    };
  },
});
