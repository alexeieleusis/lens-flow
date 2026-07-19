import { createRule } from "../utils/rule-creator.js";
import { getChildren } from "../utils/ast-helpers.js";
import type { TSESTree, TSESLint } from "@typescript-eslint/utils";

const FUNCTION_BOUNDARY_TYPES = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
]);

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

function nodeHasTargetUse(
  n: TSESTree.Node,
  targetName: string,
  seen = new Set<TSESTree.Node>(),
): boolean {
  if (seen.has(n)) return false;
  seen.add(n);

  const match = nodeMatchesTarget(n, targetName);
  if (match === "use") return true;
  if (match === "rebind") return false;

  for (const child of getChildren(n, { skipTypeAnnotations: true })) {
    if (FUNCTION_BOUNDARY_TYPES.has(child.type)) continue;
    if (nodeHasTargetUse(child, targetName, seen)) return true;
  }
  return false;
}

function hasSubsequentUse(
  body: TSESTree.Statement[],
  startIdx: number,
  targetName: string,
  skipBlock: TSESTree.Node | null = null,
): boolean {
  for (let i = startIdx; i < body.length; i++) {
    const stmt = body[i];
    if (FUNCTION_BOUNDARY_TYPES.has(stmt.type)) continue;
    if (skipBlock && stmt === skipBlock) continue;
    if (nodeHasTargetUse(stmt, targetName)) return true;
  }
  return false;
}

function findNodeIndexInStatements(
  statements: TSESTree.Statement[],
  target: TSESTree.Node,
): number {
  for (let i = 0; i < statements.length; i++) {
    if (statements[i] === target) return i;
    for (const child of getChildren(statements[i], { skipTypeAnnotations: true })) {
      if (FUNCTION_BOUNDARY_TYPES.has(child.type)) continue;
      const nestedIdx = findNodeIndexInNode(child, target);
      if (nestedIdx !== -1) return nestedIdx;
    }
  }
  return -1;
}

function findNodeIndexInNode(
  node: TSESTree.Node,
  target: TSESTree.Node,
): number {
  for (const child of getChildren(node, { skipTypeAnnotations: true })) {
    if (FUNCTION_BOUNDARY_TYPES.has(child.type)) continue;
    if (child === target) return 0;
    const nestedIdx = findNodeIndexInNode(child, target);
    if (nestedIdx !== -1) return nestedIdx;
  }
  return -1;
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
        "The result of a type-state transition method should be rebound to the original `{{letName}}` variable instead of assigned to `{{constName}}`. The stale reference remains accessible and bypasses the type-state guarantee. Prefer `{{letName}} = {{letName}}.{{methodName}}()`. See: https://github.com/alexeieleusis/lens-flow/tree/main/eslint-lensflow-plugin/docs/rules/require-typestate-rebinding.md",
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

    function findLetBinding(bindingName: string): { binding: LetBinding; scopeIdx: number } | null {
      for (let i = scopeStack.length - 1; i >= 0; i--) {
        const b = scopeStack[i].letBindings.get(bindingName);
        if (b) return { binding: b, scopeIdx: i };
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

    function resolveScopeCheckParams(
      constNode: TSESTree.Node,
      foundBinding: LetBinding,
      letScopeIdx: number,
      currentScope: ScopeFrame,
      idx: number,
    ): { letScopeBody: TSESTree.Statement[]; startCheckIdx: number; constDeclBlock: TSESTree.Node | null } | null {
      if (currentScope.stmtBody === foundBinding.scopeBody) {
        if (foundBinding.letIdx >= idx) return null;
        return {
          letScopeBody: foundBinding.scopeBody,
          startCheckIdx: idx + 1,
          constDeclBlock: null,
        };
      }

      if (letScopeIdx < scopeStack.length - 1) {
        let constDeclBlock: TSESTree.Node | null = null;
        let p: TSESTree.Node | undefined = constNode.parent;
        while (p) {
          if (foundBinding.scopeBody.includes(p as TSESTree.Statement)) {
            constDeclBlock = p;
            break;
          }
          p = p.parent;
        }
        return {
          letScopeBody: foundBinding.scopeBody,
          startCheckIdx: foundBinding.letIdx + 1,
          constDeclBlock,
        };
      }

      return null;
    }

    function processConstDeclarations(
      node: TSESTree.VariableDeclaration,
      currentScope: ScopeFrame,
      scopeBody: TSESTree.Statement[],
      idx: number,
    ) {
      for (const declarator of node.declarations) {
        const init = declarator.init;
        if (!init) continue;

        const objId = isCallOnObject(init);
        if (!objId) continue;

        const found = findLetBinding(objId.name);
        if (!found) continue;

        const { binding: foundBinding, scopeIdx: letScopeIdx } = found;
        const params = resolveScopeCheckParams(node, foundBinding, letScopeIdx, currentScope, idx);
        if (!params) continue;

        if (hasSubsequentUse(params.letScopeBody, params.startCheckIdx, objId.name, params.constDeclBlock)) {
          context.report({
            node: declarator,
            messageId: "staleStateRef",
            data: {
              letName: objId.name,
              constName:
                declarator.id.type === "Identifier"
                  ? declarator.id.name
                  : context.sourceCode.getText(declarator.id),
              methodName: (() => {
                const callee = extractCallee(init);
                return callee ? extractMethodName(callee) : "<method>";
              })(),
            },
          });
        }
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
        for (let i = scopeStack.length - 1; i >= 0; i--) {
          const scope = scopeStack[i];
          const body = scope.stmtBody;
          if (!body) continue;

          const idx = findNodeIndexInStatements(body, node);
          if (idx === -1) continue;

          if (node.kind === "let") {
            registerLetBindings(node, scope, body, idx);
          } else if (node.kind === "const") {
            processConstDeclarations(node, scope, body, idx);
          }
          return;
        }
      },
    };
  },
});
