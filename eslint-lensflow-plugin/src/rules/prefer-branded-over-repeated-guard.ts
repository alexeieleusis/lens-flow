import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

export default createRule({
  name: "prefer-branded-over-repeated-guard",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer branded types over repeated type guard checks across multiple functions",
    },
    messages: {
      repeatedGuard:
        "Type guard `{{guardName}}` is called in {{count}} functions. Consider using a branded type validated once upstream instead of repeating the guard in each function. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T26-refinement-types.md",
    },
    schema: [
      {
        type: "object",
        properties: {
          minFunctions: {
            type: "number",
            minimum: 2,
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
  },
  defaultOptions: [{ minFunctions: 2 }],
  create(context: TSESLint.RuleContext<"repeatedGuard", [{ minFunctions: number }]>) {
    const [{ minFunctions = 2 } = {}] = context.options;

    const guardNames = new Set<string>();

    function isGuardCandidate(name: string, returnTypeNode: TSESTree.TypeNode | undefined): boolean {
      if (!/^is[A-Z]/.test(name)) return false;
      if (!returnTypeNode) return false;
      return returnTypeNode.type === "TSBooleanKeyword";
    }

    function findEnclosingFunction(callNode: TSESTree.CallExpression): string | null {
      let current = (callNode as any).parent;
      while (current) {
        if (
          current.type === "FunctionDeclaration" &&
          current.id
        ) {
          return current.id.name;
        }
        if (
          current.type === "FunctionExpression" &&
          current.id
        ) {
          return current.id.name;
        }
        if (current.type === "ArrowFunctionExpression") {
          const p = current.parent;
          if (
            p?.type === "VariableDeclarator" &&
            p.id?.type === "Identifier"
          ) {
            return p.id.name;
          }
          return null;
        }
        current = current.parent;
      }
      return null;
    }

    const guardCalls: Array<{
      callNode: TSESTree.CallExpression;
      guardName: string;
      enclosingFunc: string | null;
    }> = [];

    return {
      FunctionDeclaration(node) {
        const name = node.id?.name ?? "";
        const retType = node.returnType?.typeAnnotation;
        if (name && isGuardCandidate(name, retType)) {
          guardNames.add(name);
        }
      },
      FunctionExpression(node) {
        const name = node.id?.name ?? "";
        const retType = node.returnType?.typeAnnotation;
        if (name && isGuardCandidate(name, retType)) {
          guardNames.add(name);
        }
      },
      ArrowFunctionExpression(node) {
        const parent = (node as any).parent;
        let name = "";
        if (
          parent?.type === "VariableDeclarator" &&
          parent.id.type === "Identifier"
        ) {
          name = parent.id.name;
        }
        const retType = node.returnType?.typeAnnotation;
        if (name && isGuardCandidate(name, retType)) {
          guardNames.add(name);
        }
      },
      CallExpression(node) {
        const calleeName =
          node.callee.type === "Identifier" ? node.callee.name : null;
        if (calleeName && guardNames.has(calleeName)) {
          const enclosingFunc = findEnclosingFunction(node);
          guardCalls.push({
            callNode: node,
            guardName: calleeName,
            enclosingFunc,
          });
        }
      },
      "Program:exit"() {
        const guardToFunctions = new Map<string, Set<string | null>>();
        const guardToCalls = new Map<
          string,
          Array<{ callNode: TSESTree.CallExpression; enclosingFunc: string | null }>
        >();

        for (const call of guardCalls) {
          if (!guardToFunctions.has(call.guardName)) {
            guardToFunctions.set(call.guardName, new Set());
            guardToCalls.set(call.guardName, []);
          }
          guardToFunctions.get(call.guardName)!.add(call.enclosingFunc);
          guardToCalls.get(call.guardName)!.push(call);
        }

        for (const [guardName, funcs] of guardToFunctions) {
          if (funcs.size >= minFunctions) {
            const calls = guardToCalls.get(guardName)!;
            for (const call of calls) {
              context.report({
                node: call.callNode,
                messageId: "repeatedGuard",
                data: {
                  guardName,
                  count: String(funcs.size),
                },
              });
            }
          }
        }
      },
    };
  },
});
