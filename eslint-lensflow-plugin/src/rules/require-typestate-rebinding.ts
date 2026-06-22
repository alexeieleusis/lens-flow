import { createRule } from "../utils/rule-creator.js";
import type { TSESTree, TSESLint } from "@typescript-eslint/utils";

function isCallOnObject(
  node: TSESTree.Expression,
): TSESTree.Identifier | null {
  let call: TSESTree.CallExpression | null = null;
  if (node.type === "CallExpression") {
    call = node;
  } else if (node.type === "ChainExpression") {
    call = node.expression.type === "CallExpression" ? node.expression : null;
  }
  if (!call) return null;
  if (call.callee.type === "MemberExpression") {
    const obj = call.callee.object;
    if (obj.type === "Identifier") return obj;
  }
  return null;
}

function nodeMatchesTarget(n: TSESTree.Node, targetName: string): "use" | "rebind" | null {
  if (n.type === "Identifier" && n.name === targetName) return "use";
  if (
    n.type === "VariableDeclarator" &&
    n.id.type === "Identifier" &&
    n.id.name === targetName
  ) {
    return "rebind";
  }
  return null;
}

function isTraversableNode(val: unknown): val is TSESTree.Node {
  return typeof val === "object" && val !== null && "type" in val;
}

function arrayHasTargetUse(arr: unknown[], targetName: string): boolean {
  for (const item of arr) {
    if (isTraversableNode(item) && nodeHasTargetUse(item, targetName)) {
      return true;
    }
  }
  return false;
}

function nodeHasTargetUse(n: TSESTree.Node, targetName: string): boolean {
  const match = nodeMatchesTarget(n, targetName);
  if (match === "use") return true;
  if (match === "rebind") return false;

  for (const key of Object.keys(n)) {
    if (key === "parent") continue;
    const child = (n as unknown as Record<string, unknown>)[key];

    if (Array.isArray(child)) {
      if (arrayHasTargetUse(child, targetName)) return true;
    } else if (isTraversableNode(child)) {
      if (nodeHasTargetUse(child, targetName)) return true;
    }
  }
  return false;
}

function hasSubsequentUse(
  body: TSESTree.Statement[],
  startIdx: number,
  targetName: string,
  skipDeclarators: Set<TSESTree.VariableDeclarator>,
): boolean {
  for (let i = startIdx; i < body.length; i++) {
    const stmt = body[i];
    if (
      stmt.type === "VariableDeclaration" &&
      stmt.declarations.some((d) => skipDeclarators.has(d))
    ) {
      continue;
    }
    if (nodeHasTargetUse(stmt, targetName)) return true;
  }
  return false;
}

export default createRule({
  name: "require-typestate-rebinding",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require rebinding type-state transition results to the original let variable instead of storing in a new const",
    },
    messages: {
      staleStateRef:
        "The result of a type-state transition method should be rebound to the original `{{letName}}` variable instead of assigned to `{{constName}}`. The stale reference remains accessible and bypasses the type-state guarantee. Prefer `{{letName}} = {{letName}}.{{methodName}}()`. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T57-typestate.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"staleStateRef", []>) {
    interface LetBinding {
      scopeBody: TSESTree.Statement[];
      letIdx: number;
    }

    interface ScopeFrame {
      letBindings: Map<string, LetBinding>;
      stmtBody: TSESTree.Statement[] | null;
    }

    const scopeStack: ScopeFrame[] = [{ letBindings: new Map(), stmtBody: null }];

    function getCurrentScope(): ScopeFrame {
      return scopeStack[scopeStack.length - 1];
    }

    function getScopeForBody(body: TSESTree.Statement[]): ScopeFrame | null {
      for (let i = scopeStack.length - 1; i >= 0; i--) {
        if (scopeStack[i].stmtBody === body) return scopeStack[i];
      }
      return null;
    }

    function registerLetBindings(
      node: TSESTree.VariableDeclaration,
      currentScope: ScopeFrame,
      body: TSESTree.Statement[],
      idx: number,
    ) {
      for (const decl of node.declarations) {
        if (decl.id.type === "Identifier") {
          currentScope.letBindings.set(decl.id.name, {
            scopeBody: body,
            letIdx: idx,
          });
        }
      }
    }

    function findLetBinding(bindingName: string): LetBinding | null {
      for (let i = scopeStack.length - 1; i >= 0; i--) {
        const binding = scopeStack[i].letBindings.get(bindingName);
        if (binding) return binding;
      }
      return null;
    }

    function extractCallee(
      init: TSESTree.Expression,
    ): TSESTree.Expression | null {
      if (init.type === "CallExpression") return init.callee;
      if (init.type === "ChainExpression") return init.expression;
      return null;
    }

    function extractMethodName(callee: TSESTree.Expression): string | null {
      if (
        callee.type === "MemberExpression" &&
        callee.property.type === "Identifier"
      ) {
        return callee.property.name;
      }
      return null;
    }

    function checkAndReportConstDeclarator(
      declNode: TSESTree.VariableDeclaration,
      declarator: TSESTree.VariableDeclarator,
      body: TSESTree.Statement[],
      idx: number,
      objId: TSESTree.Identifier,
    ) {
      const init = declarator.init;
      if (!init) return;

      const callee = extractCallee(init);
      const methodName = callee ? extractMethodName(callee) : null;

      const constName =
        declarator.id.type === "Identifier" ? declarator.id.name : "?";

      if (
        hasSubsequentUse(
          body,
          idx + 1,
          objId.name,
          new Set([declarator]),
        )
      ) {
        context.report({
          node: declNode,
          messageId: "staleStateRef",
          data: {
            letName: objId.name,
            constName,
            methodName: methodName ?? "<method>",
          },
        });
      }
    }

    function processConstDeclarations(
      node: TSESTree.VariableDeclaration,
      currentScope: ScopeFrame,
      body: TSESTree.Statement[],
      idx: number,
    ) {
      for (const declarator of node.declarations) {
        const init = declarator.init;
        if (!init) continue;

        const objId = isCallOnObject(init);
        if (!objId) continue;

        const foundBinding = findLetBinding(objId.name);
        if (!foundBinding) continue;

        if (
          foundBinding.scopeBody !== body ||
          foundBinding.letIdx >= idx
        )
          continue;

        checkAndReportConstDeclarator(
          node,
          declarator,
          body,
          idx,
          objId,
        );
      }
    }

    return {
      Program(node) {
        const topScope = getCurrentScope();
        topScope.stmtBody = node.body;
      },

      BlockStatement(node) {
        scopeStack.push({ letBindings: new Map(), stmtBody: node.body });
      },

      "BlockStatement:exit"() {
        scopeStack.pop();
      },

      VariableDeclaration(node) {
        const currentScope = getCurrentScope();
        const body = currentScope.stmtBody;
        if (!body) return;

        const idx = body.indexOf(node);
        if (idx === -1) return;

        if (node.kind === "let") {
          registerLetBindings(node, currentScope, body, idx);
        } else if (node.kind === "const") {
          processConstDeclarations(node, currentScope, body, idx);
        }
      },
    };
  },
});
