import { type TSESTree } from "@typescript-eslint/utils";

/**
 * Nodes representing top-level function overloads.
 *
 * Intentionally limited to `FunctionDeclaration` and `TSDeclareFunction`.
 * Class method (`MethodDefinition`) and constructor overloads are not
 * covered — a separate utility would be needed for those cases.
 */
export type FnLikeNode =
  | TSESTree.FunctionDeclaration
  | TSESTree.TSDeclareFunction;

export function isImpl(node: FnLikeNode): boolean {
  return node.type === "FunctionDeclaration" && node.body !== null;
}

export type FnGroup = {
  all: FnLikeNode[];
  impl: FnLikeNode;
  overloads: FnLikeNode[];
};

function processGroups(
  allFns: FnLikeNode[],
  onGroup: (group: FnGroup) => void,
): void {
  const byName = new Map<string, FnLikeNode[]>();
  for (const fn of allFns) {
    const name = fn.id?.name;
    if (name === undefined) continue;
    if (!byName.has(name)) byName.set(name, []);
    const group = byName.get(name);
    if (group) group.push(fn);
  }

  for (const declarations of byName.values()) {
    let impl = declarations.find(isImpl);
    let overloads: FnLikeNode[];

    if (impl) {
      overloads = declarations.filter((n) => !isImpl(n));
      if (overloads.length === 0) continue;
    } else if (declarations.length >= 2) {
      impl = declarations[0];
      overloads = declarations;
    } else {
      continue;
    }

    onGroup({ all: declarations, impl, overloads });
  }
}

export function createOverloadGroupVisitor(
  onGroup: (group: FnGroup) => void,
): {
  FunctionDeclaration: (node: TSESTree.FunctionDeclaration) => void;
  TSDeclareFunction: (node: TSESTree.TSDeclareFunction) => void;
  "Program:exit": () => void;
} {
  const allFns: FnLikeNode[] = [];

  return {
    FunctionDeclaration(node) {
      allFns.push(node);
    },
    TSDeclareFunction(node) {
      allFns.push(node);
    },
    "Program:exit"() {
      if (allFns.length === 0) return;
      processGroups(allFns, onGroup);
    },
  };
}
