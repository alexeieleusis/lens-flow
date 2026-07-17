import { type TSESTree, TSESLint } from "@typescript-eslint/utils";
import { visitorKeys as KEYS } from "@typescript-eslint/visitor-keys";
import { createRule } from "../utils/rule-creator.js";
import type { FnLikeNode } from "../utils/overload-grouping.js";
import { createOverloadGroupVisitor } from "../utils/overload-grouping.js";

function isNodeLike(v: unknown): v is TSESTree.Node {
  return v != null && typeof v === "object" && "type" in v;
}

type NodePropertyValue =
  | TSESTree.Node
  | TSESTree.Node[]
  | string
  | number
  | boolean
  | null
  | undefined;

function getNodeProps(node: TSESTree.Node): Record<string, NodePropertyValue> {
  return node as unknown as Record<string, NodePropertyValue>;
}

const SKIP_KEYS = new Set(["loc", "range", "parent", "start", "end"]);

function valuesEqual(
  aVal: NodePropertyValue,
  bVal: NodePropertyValue,
  visited: Set<string>,
): boolean {
  if (Array.isArray(aVal) && Array.isArray(bVal)) {
    return arraysEqual(aVal, bVal, visited);
  }

  if (isNodeLike(aVal) && isNodeLike(bVal)) {
    return astEquals(aVal, bVal, visited);
  }

  return aVal === bVal;
}

function arraysEqual(
  aVal: TSESTree.Node[],
  bVal: TSESTree.Node[],
  visited: Set<string>,
): boolean {
  if (aVal.length !== bVal.length) return false;

  for (let i = 0; i < aVal.length; i++) {
    const av = aVal[i];
    const bv = bVal[i];

    if (isNodeLike(av) && isNodeLike(bv)) {
      if (!astEquals(av, bv, visited)) return false;
    } else if (av !== bv) {
      return false;
    }
  }

  return true;
}

function astEquals(
  a: TSESTree.Node,
  b: TSESTree.Node,
  visited: Set<string>,
): boolean {
  if (a.type !== b.type) return false;

  const pairKey = `${a.type}:${String(a.range?.[0] ?? 0)}-${String(b.range?.[0] ?? 0)}`;
  if (visited.has(pairKey)) return true;
  visited.add(pairKey);

  const childKeys = new Set(KEYS[a.type] ?? []);

  const aProps = getNodeProps(a);
  const bProps = getNodeProps(b);

  for (const key of Object.getOwnPropertyNames(aProps).sort()) {
    if (SKIP_KEYS.has(key)) continue;

    const aVal = aProps[key];
    const bVal = bProps[key];

    if (childKeys.has(key)) {
      if (Array.isArray(aVal) && Array.isArray(bVal)) {
        if (!arraysEqual(aVal, bVal, visited)) return false;
      } else if (isNodeLike(aVal) && isNodeLike(bVal)) {
        if (!astEquals(aVal, bVal, visited)) return false;
      } else if ((aVal == null) !== (bVal == null)) {
        return false;
      }
    } else if (aVal !== bVal) {
      return false;
    }
  }

  for (const key of Object.getOwnPropertyNames(bProps).sort((a, b) => a.localeCompare(b))) {
    if (SKIP_KEYS.has(key)) continue;
    if (Object.prototype.hasOwnProperty.call(aProps, key)) continue;
    return false;
  }

  return true;
}

function sigEquals(a: FnLikeNode, b: FnLikeNode): boolean {
  const visited = new Set<string>();

  if (a.params.length !== b.params.length) return false;
  for (let i = 0; i < a.params.length; i++) {
    if (!astEquals(a.params[i], b.params[i], visited)) return false;
  }

  const aRet = a.returnType;
  const bRet = b.returnType;
  if (!aRet && !bRet) return true;
  if (!aRet || !bRet) return false;
  return astEquals(aRet.typeAnnotation, bRet.typeAnnotation, visited);
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
        "Redundant overload signature identical to implementation. Remove the overload and keep only the implementation. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T22-callable-typing.md",
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
