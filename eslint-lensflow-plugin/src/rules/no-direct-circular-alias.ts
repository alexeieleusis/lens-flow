import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { getChildren } from "../utils/ast-helpers.js";

function getTypeName(typeName: TSESTree.Identifier | TSESTree.ThisExpression | TSESTree.TSQualifiedName): string | null {
  if (typeName.type === "Identifier") {
    return typeName.name;
  }
  if (typeName.type === "TSQualifiedName") {
    return null;
  }
  return null;
}

type SelfRef = { node: TSESTree.TSTypeReference; ancestors: TSESTree.TypeNode[] };

function getTSChildren(node: TSESTree.Node): TSESTree.Node[] {
  return getChildren(node).filter(
    (child) => child.type.startsWith("TS"),
  );
}

function collectSelfRefs(
  node: TSESTree.Node,
  aliasName: string,
  ancestors: TSESTree.TypeNode[],
  visited: Set<TSESTree.Node> = new Set(),
): SelfRef[] {
  const results: SelfRef[] = [];

  if (visited.has(node)) return results;
  visited.add(node);

  if (node.type === "TSTypeReference") {
    const name = getTypeName(node.typeName);
    if (name === aliasName) {
      results.push({ node, ancestors: [...ancestors] });
    }
  }

  const extendedAncestors = [...ancestors, node as TSESTree.TypeNode];
  for (const child of getTSChildren(node)) {
    results.push(...collectSelfRefs(child, aliasName, extendedAncestors, visited));
  }

  return results;
}

export default createRule({
  name: "no-direct-circular-alias",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow type aliases that directly reference themselves without object-property indirection",
    },
    messages: {
      directCircularReference:
        "Type alias '{{name}}' directly references itself, causing a TS2456 circular reference error. Wrap the reference in an object type, e.g. type {{name}} = { value: {{name}} }. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T23-type-aliases.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"directCircularReference", []>) {
    return {
      TSTypeAliasDeclaration(node) {
        const aliasName = node.id.name;
        const typeAnnotation = node.typeAnnotation;
        if (!typeAnnotation) return;

        const selfRefs = collectSelfRefs(typeAnnotation, aliasName, []);

        for (const ref of selfRefs) {
          const hasObjectIndirection = ref.ancestors.some(
            (anc) => anc.type === "TSTypeLiteral",
          );
          if (!hasObjectIndirection) {
            context.report({
              node: ref.node,
              messageId: "directCircularReference",
              data: { name: aliasName },
            });
          }
        }
      },
    };
  },
});
