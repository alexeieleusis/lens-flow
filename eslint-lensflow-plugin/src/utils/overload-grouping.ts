import { type TSESTree } from "@typescript-eslint/utils";

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

      let i = 0;
      while (i < allFns.length) {
        let implIdx = -1;
        for (let j = i; j < allFns.length; j++) {
          if (isImpl(allFns[j])) {
            implIdx = j;
            break;
          }
        }

        if (implIdx < 0) {
          break;
        }

        const impl = allFns[implIdx];
        const implName = impl.id?.name;
        const group = allFns
          .slice(i, implIdx + 1)
          .filter((n) => n.id?.name === implName);
        const overloads = group.filter((n) => !isImpl(n));

        onGroup({ all: group, impl, overloads });

        i = implIdx + 1;
      }
    },
  };
}
