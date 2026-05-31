import { type TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import type { FnLikeNode } from "../utils/overload-grouping.js";
import { createOverloadGroupVisitor } from "../utils/overload-grouping.js";

function isNodeLike(
  v: unknown,
): v is Record<string, unknown> & { type: unknown } {
  return (
    v != null &&
    typeof v === "object" &&
    "type" in v
  );
}

function valuesEqual(aVal: unknown, bVal: unknown): boolean {
  if (Array.isArray(aVal) && Array.isArray(bVal)) {
    return arraysEqual(aVal, bVal);
  }

  if (isNodeLike(aVal) && isNodeLike(bVal)) {
    return astEquals(aVal as unknown as TSESTree.Node, bVal as unknown as TSESTree.Node);
  }

  return aVal === bVal;
}

function arraysEqual(
  aVal: unknown[],
  bVal: unknown[],
): boolean {
  if (aVal.length !== bVal.length) return false;

  for (let i = 0; i < aVal.length; i++) {
    const av = aVal[i];
    const bv = bVal[i];

    if (isNodeLike(av) && isNodeLike(bv)) {
      if (!astEquals(av as unknown as TSESTree.Node, bv as unknown as TSESTree.Node))
        return false;
    } else if (av !== bv) {
      return false;
    }
  }

  return true;
}

function astEquals(
  a: TSESTree.Node | undefined | null,
  b: TSESTree.Node | undefined | null,
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.type !== b.type) return false;

  const skip = new Set(["loc", "range", "parent"]);
  const keysA = Object.keys(a as unknown as Record<string, unknown>).filter(
    (k) => !skip.has(k),
  );
  const keysB = Object.keys(b as unknown as Record<string, unknown>).filter(
    (k) => !skip.has(k),
  );

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    const aVal = (a as unknown as Record<string, unknown>)[key];
    const bVal = (b as unknown as Record<string, unknown>)[key];

    if (!valuesEqual(aVal, bVal)) return false;
  }

  return true;
}

function sigEquals(a: FnLikeNode, b: FnLikeNode): boolean {
  if (a.params.length !== b.params.length) return false;
  for (let i = 0; i < a.params.length; i++) {
    const ap = a.params[i];
    const bp = b.params[i];
    if (ap.type !== bp.type) return false;
    if (
      ap.type === "Identifier" &&
      bp.type === "Identifier" &&
      ap.name !== bp.name
    )
      return false;
    if (!astEquals((ap as any).typeAnnotation, (bp as any).typeAnnotation)) return false;
  }
  return astEquals(a.returnType, b.returnType);
}

export default createRule({
  name: "no-redundant-overload-signature",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow overload declarations that are identical to the implementation signature",
    },
    messages: {
      redundantOverload:
        "Redundant overload signature identical to implementation. Remove the overload and keep only the implementation. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T22-callable-typing.md",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"redundantOverload", []>) {
    const visitor = createOverloadGroupVisitor(({ impl, overloads }) => {
      if (overloads.length > 0 && impl.id?.type === "Identifier") {
        for (const overload of overloads) {
          if (sigEquals(overload, impl)) {
            context.report({
              node: overload,
              messageId: "redundantOverload",
            });
          }
        }
      }
    });

    return visitor;
  },
});
