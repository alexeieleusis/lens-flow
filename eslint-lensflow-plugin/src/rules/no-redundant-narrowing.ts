import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

function collectIdentifiers(
  node: TSESTree.Node,
  out: TSESTree.Identifier[] = [],
): TSESTree.Identifier[] {
  if (node.type === "Identifier") {
    out.push(node);
  } else if ("type" in node && typeof (node as any).type === "string") {
    for (const key of Object.keys(node)) {
      if (key === "type" || key === "loc" || key === "range" || key === "parent") continue;
      const child = (node as any)[key];
      if (Array.isArray(child)) {
        for (const item of child) {
          if (item && typeof item === "object") collectIdentifiers(item, out);
        }
      } else if (child && typeof child === "object") {
        collectIdentifiers(child, out);
      }
    }
  }
  return out;
}

function testsEqual(
  context: Parameters<ReturnType<typeof createRule>["create"]>[0],
  a: TSESTree.Node,
  b: TSESTree.Node,
): boolean {
  if (a.type !== b.type) return false;

  if (context.sourceCode.getText(a) !== context.sourceCode.getText(b)) return false;

  const idsA = collectIdentifiers(a);
  const idsB = collectIdentifiers(b);

  if (idsA.length !== idsB.length) return false;

  for (let i = 0; i < idsA.length; i++) {
    const idA = idsA[i];
    const idB = idsB[i];

    let scopeA: TSESLint.Scope.Scope | null = context.sourceCode.getScope(a);
    let bindingA: TSESLint.Scope.Variable | undefined;
    while (scopeA) {
      bindingA = scopeA.set.get(idA.name);
      if (bindingA) break;
      scopeA = scopeA.upper;
    }

    let scopeB: TSESLint.Scope.Scope | null = context.sourceCode.getScope(b);
    let bindingB: TSESLint.Scope.Variable | undefined;
    while (scopeB) {
      bindingB = scopeB.set.get(idB.name);
      if (bindingB) break;
      scopeB = scopeB.upper;
    }

    if (bindingA !== bindingB) return false;
  }

  return true;
}

export default createRule({
  name: "no-redundant-narrowing",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow redundant narrowing checks that repeat an outer block's identical check (binary comparisons, typeof, instanceof, truthiness, and call expressions)",
    },
    messages: {
      redundantNarrowing:
        "This narrowing check is redundant because an outer block already performed the same check. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T14-type-narrowing.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"redundantNarrowing", []>) {
    const nestedBodyKinds = [
      "consequent",
      "alternate",
      "body",
      "finalizer",
      "init",
      "update",
      "test",
    ] as const;

    function checkAndWalk(node: TSESTree.Node, outerTest: TSESTree.Node): void {
      if (node.type === "IfStatement" && testsEqual(context, outerTest, node.test)) {
        context.report({
          node,
          messageId: "redundantNarrowing",
        });
      }
      walkNode(node, outerTest);
    }

    function walkNode(node: TSESTree.Node, outerTest: TSESTree.Node): void {
      for (const key of nestedBodyKinds) {
        const child = (node as any)[key];
        if (!child) continue;

        if (Array.isArray(child)) {
          for (const item of child) {
            checkAndWalk(item, outerTest);
          }
        } else {
          checkAndWalk(child, outerTest);
        }
      }
    }

    return {
      IfStatement(node) {
        if (node.consequent.type === "BlockStatement") {
          for (const stmt of node.consequent.body) {
            checkAndWalk(stmt, node.test);
          }
        } else {
          checkAndWalk(node.consequent, node.test);
        }

        if (node.alternate) {
          if (node.alternate.type === "BlockStatement") {
            for (const stmt of node.alternate.body) {
              checkAndWalk(stmt, node.test);
            }
          } else {
            checkAndWalk(node.alternate, node.test);
          }
        }
      },
    };
  },
});
