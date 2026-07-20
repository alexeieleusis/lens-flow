import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T14-type-narrowing.md");

const SKIPPED_KEYS = new Set(["type", "loc", "range", "parent"]);

function visitChildValue(child: unknown, out: TSESTree.Identifier[]): void {
  if (Array.isArray(child)) {
    for (const item of child) {
      if (item && typeof item === "object") collectIdentifiers(item as TSESTree.Node, out);
    }
  } else if (child && typeof child === "object") {
    collectIdentifiers(child as TSESTree.Node, out);
  }
}

function collectIdentifiers(
  node: TSESTree.Node,
  out: TSESTree.Identifier[] = [],
): TSESTree.Identifier[] {
  if (node.type === "Identifier") {
    out.push(node);
    return out;
  }
  if (!("type" in node) || typeof (node as any).type !== "string") return out;

  for (const key of Object.keys(node)) {
    if (SKIPPED_KEYS.has(key)) continue;
    visitChildValue((node as any)[key], out);
  }
  return out;
}

function resolveBinding(
  context: Parameters<ReturnType<typeof createRule>["create"]>[0],
  node: TSESTree.Node,
  name: string,
): TSESLint.Scope.Variable | undefined {
  let scope: TSESLint.Scope.Scope | null = context.sourceCode.getScope(node);
  while (scope) {
    const binding = scope.set.get(name);
    if (binding) return binding;
    scope = scope.upper;
  }
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
    const bindingA = resolveBinding(context, a, idsA[i].name);
    const bindingB = resolveBinding(context, b, idsB[i].name);
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
         "This narrowing check is redundant because an outer block already performed the same check. See: {{url}}",
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
          data: { url: URL },
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
