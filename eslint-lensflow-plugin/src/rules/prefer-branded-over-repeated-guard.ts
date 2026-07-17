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
        "Type guard `{{guardName}}` is called in {{count}} functions. Consider using a branded type validated once upstream instead of repeating the guard in each function. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T26-refinement-types.md",
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
      const ancestors = context.sourceCode.getAncestors(callNode);
      for (const node of ancestors) {
        if (node.type === "FunctionDeclaration" && node.id) {
          return node.id.name;
        }
        if (node.type === "FunctionExpression" && node.id) {
          return node.id.name;
        }
        if (node.type === "MethodDefinition" && node.key.type === "Identifier") {
          let className = "anonymous";
          const idx = ancestors.indexOf(node);
          for (let i = idx - 1; i >= 0; i--) {
            const a = ancestors[i];
            if (a.type === "ClassDeclaration" && a.id) {
              className = a.id.name;
              break;
            }
            if (a.type === "ClassExpression" && a.id) {
              className = a.id.name;
              break;
            }
          }
          return `${className}.${node.key.name}`;
        }
        if (node.type === "ArrowFunctionExpression") {
          const varDecl = ancestors
            .slice(ancestors.indexOf(node) + 1)
            .find((a) => a.type === "VariableDeclarator");
          if (varDecl?.id.type === "Identifier") {
            return varDecl.id.name;
          }
          return null;
        }
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
        const ancestors = context.sourceCode.getAncestors(node);
        const varDecl = ancestors.find((a) => a.type === "VariableDeclarator");
        let name = "";
        if (varDecl?.id.type === "Identifier") {
          name = varDecl.id.name;
        }
        const retType = node.returnType?.typeAnnotation;
        if (name && isGuardCandidate(name, retType)) {
          guardNames.add(name);
        }
      },
      MethodDefinition(node) {
        if (node.key.type !== "Identifier") return;
        const name = node.key.name;
        const retType = (node.value as TSESTree.FunctionExpression).returnType?.typeAnnotation;
        if (name && isGuardCandidate(name, retType)) {
          guardNames.add(name);
        }
      },
      TSDeclareFunction(node) {
        const name = node.id?.name ?? "";
        const retType = node.returnType?.typeAnnotation;
        if (name && isGuardCandidate(name, retType)) {
          guardNames.add(name);
        }
      },
      CallExpression(node) {
        let calleeName: string | null = null;
        if (node.callee.type === "Identifier") {
          calleeName = node.callee.name;
        } else if (
          node.callee.type === "MemberExpression" &&
          node.callee.property.type === "Identifier"
        ) {
          calleeName = node.callee.property.name;
        }
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
